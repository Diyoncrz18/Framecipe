#!/usr/bin/env python3
"""Delivery-pace QC for TTS output.

TTS engines drift in speaking rate — and cloned voices inherit pace from
their reference audio in a way temperature cannot correct (a short, snappy
reference reliably produces 170-210 wpm narration, retake after retake).
Sampling more takes doesn't fix pace; measuring it and correcting
deterministically does.

This module provides the two halves of that fix:

  * measure_wpm()/pace_label() — words-per-minute from script text + audio
    duration, with "fast"/"slow"/"ok" labels for QC gates
  * clamp_pace() — pitch-preserving ffmpeg `atempo` slow-down applied when
    a take exceeds a target wpm (floor 0.85x so it never sounds processed;
    `--min-tempo` lowers it to as far as 0.7x for voices that rush harder)

Used by voiceover.py and qwen3_tts.py (`--max-wpm`, `--min-tempo`). Comfortable narration
is ~140-160 wpm; see CLAUDE.md "Speaking Rate Tiers".
"""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Warn outside this band (only when the clip has enough words to measure).
WARN_FAST_WPM = 170
WARN_SLOW_WPM = 110

# Below this many words a wpm figure is mostly noise — don't label it.
MIN_WORDS_FOR_LABEL = 6

# Never stretch harder than this; beyond it artifacts become audible.
MIN_ATEMPO = 0.85
# How far set_min_tempo() may lower that floor. Past ~0.7x atempo smears consonants.
MIN_ATEMPO_LIMIT = 0.7


def set_min_tempo(value: float) -> None:
    """Lower (or raise) the stretch floor for this process, e.g. from --min-tempo."""
    global MIN_ATEMPO
    if not MIN_ATEMPO_LIMIT <= value <= 1.0:
        raise ValueError(f"min tempo must be between {MIN_ATEMPO_LIMIT} and 1.0, got {value}")
    MIN_ATEMPO = value

_MARKUP = re.compile(
    r"\[pause[^\]]*\]"          # [pause 1.0s] script markers
    r"|<break[^>]*/?>"          # SSML <break time="1s"/>
    r"|^\[(tone|instruct):[^\]]*\]\s*",  # per-scene header line
    re.IGNORECASE | re.MULTILINE,
)


def spoken_text(text: str) -> str:
    """Script text with pause markers, SSML breaks and tone headers removed."""
    return _MARKUP.sub(" ", text)


def count_words(text: str) -> int:
    """Spoken-word count: ignores pause markers, SSML breaks, tone headers."""
    return len(spoken_text(text).split())


def measure_wpm(text: str, duration_seconds: float | None) -> float | None:
    """Words per minute, or None if it can't be measured."""
    if not duration_seconds or duration_seconds <= 0:
        return None
    words = count_words(text)
    if words == 0:
        return None
    return round(words / duration_seconds * 60, 1)


def pace_label(text: str, duration_seconds: float | None) -> tuple[float | None, str | None]:
    """Return (wpm, label) where label is 'fast' | 'slow' | 'ok' | None.

    None label means "not enough signal" (short clip or missing duration).
    Note: pause markers stretch duration without adding words, so scripts
    with long scripted pauses read slightly slow — treat 'slow' as a hint.
    """
    wpm = measure_wpm(text, duration_seconds)
    if wpm is None or count_words(text) < MIN_WORDS_FOR_LABEL:
        return wpm, None
    if wpm > WARN_FAST_WPM:
        return wpm, "fast"
    if wpm < WARN_SLOW_WPM:
        return wpm, "slow"
    return wpm, "ok"


def _probe_duration(path: str) -> float | None:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=30,
        )
        return float(out.stdout.strip())
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def clamp_pace(
    audio_path: str,
    text: str,
    max_wpm: float,
    min_atempo: float | None = None,
    verbose: bool = True,
) -> dict:
    """Slow `audio_path` in place (pitch-preserving) if it exceeds max_wpm.

    Returns {applied, wpm, atempo?, floored?, duration_seconds?, error?}:
      * applied=False, no error — pace was already within target
      * applied=True — file replaced; duration_seconds is the new duration
      * floored=True — the stretch hit the floor and the take is still over
        max_wpm; a lower --min-tempo (or a slower reference) would finish the job
      * error set — ffmpeg/ffprobe problem; original file left untouched
    """
    if min_atempo is None:
        min_atempo = MIN_ATEMPO
    duration = _probe_duration(audio_path)
    wpm = measure_wpm(text, duration)
    if wpm is None:
        return {"applied": False, "wpm": None, "error": "could not measure wpm"}
    if wpm <= max_wpm:
        return {"applied": False, "wpm": wpm}

    atempo = max(max_wpm / wpm, min_atempo)
    suffix = Path(audio_path).suffix or ".mp3"
    codec_args = ["-b:a", "192k"] if suffix.lower() == ".mp3" else []
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.close()
    try:
        r = subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", str(audio_path),
             "-filter:a", f"atempo={atempo:.4f}", *codec_args, tmp.name],
            capture_output=True, text=True, timeout=120,
        )
        if r.returncode != 0:
            return {"applied": False, "wpm": wpm,
                    "error": f"ffmpeg atempo failed: {r.stderr.strip()[-200:]}"}
        shutil.move(tmp.name, str(audio_path))
    except (OSError, subprocess.TimeoutExpired) as e:
        return {"applied": False, "wpm": wpm, "error": f"ffmpeg atempo failed: {e}"}
    finally:
        Path(tmp.name).unlink(missing_ok=True)

    new_duration = _probe_duration(audio_path)
    new_wpm = measure_wpm(text, new_duration)
    floored = atempo == min_atempo and new_wpm is not None and new_wpm > max_wpm + 1
    if verbose:
        print(
            f"  Pace clamp: {wpm:.0f} wpm > {max_wpm:.0f} target — "
            f"stretched x{1/atempo:.2f} → {new_wpm:.0f} wpm"
            + (f" (hit the {min_atempo}x floor; try --min-tempo {max(MIN_ATEMPO_LIMIT, round(min_atempo - 0.05, 2))})" if floored else ""),
            file=sys.stderr,
        )
    return {
        "applied": True,
        "wpm": new_wpm,
        "original_wpm": wpm,
        "atempo": round(atempo, 4),
        "floored": floored,
        "duration_seconds": round(new_duration, 2) if new_duration else None,
    }
