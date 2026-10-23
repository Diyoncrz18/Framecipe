"""
Modal deployment for LTX-2 video generation.

Text-to-video and image-to-video generation with a 22B LTX-2 DiT model.
Generates ~5s video clips at up to 1024x1536 resolution with audio.

Deploy (the model version is a deploy-time choice):
    modal deploy docker/modal-ltx2/app.py                    # LTX-2.3 (default)
    LTX2_VERSION=2.5 modal deploy docker/modal-ltx2/app.py   # LTX-2.5 (opt-in)

LTX-2.3 is the default. LTX-2.5 is opt-in: benchmarked against 2.3 it is
~25-45% slower per clip and the crt-terminal LoRA only works on 2.3
(docs/ltx2.md#benchmarks).
The 2.3 image is built exactly as before the switch existed, so a 2.3 redeploy
reuses its cached layers.

Both versions need the `huggingface-token` Modal secret (key HF_TOKEN; set
HF_SECRET_NAME at deploy time to use another name), and the token's account needs access to a gated repo:
- 2.3: Google's Gemma 3 text encoder (google/gemma-3-12b-it-qat-q4_0-unquantized,
  approved by hand).
- 2.5: Lightricks/LTX-2.5 ("Agree and Access" shares your contact info; approved
  automatically). LTX-2.x Community License: free under $10M annual revenue,
  commercial use included; watermark and provenance features must not be removed.

Switch versions with `modal deploy --strategy recreate`, so a warm container of
the previous version can't serve the next request. The response's "model" field
says which version ran.

Input format (POST JSON to web endpoint):
{
    "prompt": str,                     # Required: text description
    "negative_prompt": str,            # Optional (sensible default provided)
    "image_url": str,                  # Optional: URL for image-to-video
    "image_base64": str,              # Optional: base64 for image-to-video
    "width": int,                      # Default: 768 (must be divisible by 64)
    "height": int,                     # Default: 512 (must be divisible by 64)
    "num_frames": int,                 # Default: 121 (must satisfy (n-1)%8==0)
    "fps": int,                        # Default: 24
    "num_inference_steps": int,        # Default: 30
    "seed": int,                       # Optional: random if not set
    "quality": "standard" | "fast",    # Default: "standard"
    "lora": str,                       # Optional: style LoRA key (e.g. "crt-terminal")
    "r2": dict                         # Optional: R2 upload config
}

Output format:
{
    "success": true,
    "seed": int,
    "duration": float,
    "width": int,
    "height": int,
    "num_frames": int,
    "fps": int,
    "inference_time_ms": int,
    "model": str,                      # HF repo of the deployed version
    "video_base64": str,               # If no R2
    "output_url": str,                 # If R2 configured
    "r2_key": str                      # If R2 configured
}
"""

import os

import modal

# Read at deploy time, and again inside the container when it re-imports this
# file. A non-default value rides into the container in the image env (see the
# class below); 2.3 adds nothing there, which keeps its image unchanged.
LTX2_VERSION = os.environ.get("LTX2_VERSION", "2.3")
if LTX2_VERSION not in ("2.3", "2.5"):
    raise ValueError(f"LTX2_VERSION must be '2.3' or '2.5', got {LTX2_VERSION!r}")

# Modal secret holding HF_TOKEN (build-time downloads and the running container).
# Modal's Hugging Face template names it "huggingface-secret"; tools/modal_setup.py
# sets this for you. Like LTX2_VERSION, a non-default value rides into the image env.
HF_SECRET_NAME = os.environ.get("HF_SECRET_NAME", "huggingface-token")

app = modal.App("video-toolkit-ltx2")

LTX2_REPO_URL = "https://github.com/Lightricks/LTX-2.git"
# Local path inside the container where weights are stored
MODEL_DIR = "/models/ltx2"
# Style LoRAs baked into the image. Map of CLI key → {repo, filename, strength}.
# Add new LoRAs here to ship them in the container. crt-terminal was trained on
# 2.3 and hasn't been validated on 2.5 (Lightricks reports most 2.3 LoRAs run
# on 2.5 unchanged, with a few exceptions).
LORA_DIR = "/models/loras"
AVAILABLE_LORAS = {
    "crt-terminal": {
        "repo": "lovis93/crt-animation-terminal-ltx-2.3-lora",
        "filename": "crtanim_10000.safetensors",
        "strength": 1.0,
    },
}

if LTX2_VERSION == "2.3":
    # Pinned: upstream main (Aug 2026+) calls torch.compiler.nested_compile_region
    # and pins torch 2.13, so an unpinned clone crashes on import against the
    # torch 2.7 installed below (#94). This is the commit the pipeline code here
    # was written against. Bump deliberately, together with torch, then re-run a
    # smoke render.
    LTX2_REPO_REF = "a2c3f24078eb918171967f74b6f66b756b29ee45"

    # HuggingFace model repos (2.3 weights are split across repos)
    HF_REPO = "Lightricks/LTX-2.3"
    HF_REPO_FP8 = "Lightricks/LTX-2.3-fp8"
    # Gemma 3 text encoder: the QAT checkpoint, stored unquantized in bf16 (~24GB)
    GEMMA_REPO = "google/gemma-3-12b-it-qat-q4_0-unquantized"
    GEMMA_DIR = "/models/gemma3"
else:
    # Pinned to the v1.4.2 release (2026-10-02). LTX-2.5 support landed in
    # v1.2.0, along with Gemma 4, split checkpoints and transformers 5.x.
    # Upstream tests on torch 2.13 (its natten extra pins it), which is what the
    # 2.5 image installs. Bump deliberately, together with torch, then re-run a
    # smoke render.
    LTX2_REPO_REF = "9ec55f9f22798a3198d9c923856824821bc3317e"

    # 2.5 ships as a split pack, one file per component, and bundles its own
    # Gemma 4 text encoder (no separate Gemma repo). Files keep the repo's
    # folder layout under MODEL_DIR.
    HF_REPO = "Lightricks/LTX-2.5"
    # Pinned so every rebuild bakes the same files. The six used here last
    # changed on 2026-08-17; the repo itself still changes (last on 2026-10-11).
    HF_REVISION = "49b093a39c19169a8a81721dcc541e07e945232f"
    # The dev transformer + distilled LoRA keeps the guided two-stage pipeline
    # (CFG/STG, negative prompt, adjustable steps) that "quality" and
    # "num_inference_steps" control. The distilled transformer would be faster
    # but runs a fixed 8+3 step schedule with no guidance, so those options
    # would do nothing.
    TRANSFORMER_FILE = "diffusion_models/ltx-2.5-22b-dev-transformer-bf16.safetensors"
    DISTILLED_LORA_FILE = "loras/ltx-2.5-22b-distilled-lora-450-bf16.safetensors"
    SPATIAL_UPSAMPLER_FILE = (
        "latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"
    )
    # Diffusion video decoder (DiffVAE), not the lighter -conv- variant: it's the
    # 2.5 decoder upgrade (sharper faces/textures), and NATTEN makes it fast.
    VIDEO_VAE_FILE = "vae/ltx-2.5-video-vae-bf16.safetensors"
    AUDIO_VAE_FILE = "vae/ltx-2.5-audio-vae-bf16.safetensors"
    TEXT_ENCODER_FILE = "text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors"


def _image_23() -> modal.Image:
    """The LTX-2.3 image, layer for layer as it was before LTX2_VERSION existed.

    Keep every evaluated string here unchanged, formatting included: Modal
    caches each layer by its definition, so any edit makes every 2.3
    deployment rebuild that layer and all the layers after it (up to ~80GB of
    weight downloads).
    """
    return (
        modal.Image.debian_slim(python_version="3.12")
        .apt_install("git", "ffmpeg")
        # PyTorch with CUDA 12.6 (separate index)
        .pip_install(
            "torch==2.7.0",
            "torchaudio==2.7.0",
            index_url="https://download.pytorch.org/whl/cu126",
        )
        # Other dependencies (from PyPI)
        .pip_install(
            "einops",
            "numpy>=1.26",
            "transformers==4.57.6",
            "safetensors",
            "accelerate",
            "scipy>=1.14",
            "av",
            "tqdm",
            "Pillow",
            "boto3",
            "requests",
            "fastapi[standard]",
            "huggingface_hub>=0.25.0",
        )
        # Install flash-attn for optimized attention (optional, best-effort)
        .pip_install("packaging")
        .run_commands(
            "pip install --no-cache-dir flash-attn --no-build-isolation "
            "|| echo 'flash-attn not available, using SDPA fallback'"
        )
        # Fetch LTX-2 at the pinned ref and install its packages. Fetch-by-SHA
        # rather than `clone --branch`, which only takes a ref name.
        .run_commands(
            "git init /app/ltx2",
            f"git -C /app/ltx2 remote add origin {LTX2_REPO_URL}",
            f"git -C /app/ltx2 fetch --depth 1 origin {LTX2_REPO_REF}",
            "git -C /app/ltx2 checkout FETCH_HEAD",
            "pip install -e /app/ltx2/packages/ltx-core",
            "pip install -e /app/ltx2/packages/ltx-pipelines",
        )
        # Bake LTX-2.3 model weights — full quality bf16 dev checkpoint + distilled LoRA + upsampler
        # Dev checkpoint (46.1GB) + distilled LoRA (7.6GB) + spatial upsampler (1GB) = ~55GB
        .run_commands(
            "python -c \""
            "from huggingface_hub import snapshot_download; "
            f"snapshot_download('{HF_REPO}', local_dir='{MODEL_DIR}', "
            "allow_patterns=['ltx-2.3-22b-dev.safetensors', "
            "'ltx-2.3-22b-distilled-lora-384.safetensors', "
            "'ltx-2.3-spatial-upscaler-x2-1.1.safetensors'])"
            "\"",
            secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
        )
        # Bake Gemma 3 12B text encoder (~24GB of bf16 shards)
        # Gemma is a gated model — needs HF_TOKEN at build time
        .run_commands(
            "python -c \""
            "from huggingface_hub import snapshot_download; "
            f"snapshot_download('{GEMMA_REPO}', local_dir='{GEMMA_DIR}', "
            ")"
            "\"",
            secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
        )
        # Bake style LoRAs (~500MB each). One hf_hub_download per entry so each
        # LoRA lives at /models/loras/<key>/<filename> and swaps are cheap.
        .run_commands(
            *[
                "python -c \""
                "from huggingface_hub import hf_hub_download; "
                f"hf_hub_download(repo_id='{meta['repo']}', "
                f"filename='{meta['filename']}', "
                f"local_dir='{LORA_DIR}/{key}')"
                "\""
                for key, meta in AVAILABLE_LORAS.items()
            ],
        )
    )


def _image_25() -> modal.Image:
    """The LTX-2.5 image: LTX-2 v1.4.2 on torch 2.13 / CUDA 13.0, ~80GB of weights."""
    return (
        modal.Image.debian_slim(python_version="3.12")
        .apt_install("git", "ffmpeg")
        # PyTorch 2.13 with CUDA 13.0 (separate index). Upstream uses cu132; cu130
        # matches the driver on Modal hosts (580 / CUDA 13.0). torchaudio stopped
        # at 2.11, which is what upstream pairs with torch 2.13 too.
        .pip_install(
            "torch==2.13.0",
            "torchvision==0.28.0",
            "torchaudio==2.11.0",
            index_url="https://download.pytorch.org/whl/cu130",
        )
        # Other dependencies (from PyPI). ltx-core needs transformers >=5.8,<5.15
        # for Gemma 4; 5.14.1 is the newest it documents as verified.
        .pip_install(
            "einops",
            "numpy>=1.26",
            "transformers==5.14.1",
            "safetensors",
            "accelerate",
            "scipy>=1.14",
            "av",
            "tqdm",
            "Pillow",
            "colour-science",
            "openimageio",
            "cloudpickle>=3.1",
            "boto3",
            "requests",
            "fastapi[standard]",
            "huggingface_hub[hf_xet]",
        )
        # NATTEN accelerates the diffusion video decoder (falls back to Triton
        # without it). Same version upstream's natten extra pins, cu130 build.
        .pip_install(
            "https://github.com/SHI-Labs/NATTEN/releases/download/v0.21.7/"
            "natten-0.21.7%2Btorch2130cu130-cp312-cp312-linux_x86_64.whl"
        )
        # Fetch LTX-2 at the pinned ref and install its packages. Fetch-by-SHA
        # rather than `clone --branch`, which only takes a ref name.
        .run_commands(
            "git init /app/ltx2",
            f"git -C /app/ltx2 remote add origin {LTX2_REPO_URL}",
            f"git -C /app/ltx2 fetch --depth 1 origin {LTX2_REPO_REF}",
            "git -C /app/ltx2 checkout FETCH_HEAD",
            "pip install -e /app/ltx2/packages/ltx-core",
            "pip install -e /app/ltx2/packages/ltx-pipelines",
        )
        # torch 2.13 pins cuDNN 9.20, which lacks libcudnn_engines_tensor_ir.
        # Upstream overrides it to 9.24.0.43 (see LTX-2's root pyproject.toml).
        # Last pip step so nothing downgrades it again.
        .run_commands("pip install nvidia-cudnn-cu13==9.24.0.43")
        # Bake LTX-2.5 weights at the pinned revision. Gated repo, needs HF_TOKEN
        # at build time. One layer per large component so a failed download
        # doesn't redo the rest.
        # Dev transformer (42GB)
        .run_commands(
            "python -c \""
            "from huggingface_hub import snapshot_download; "
            f"snapshot_download('{HF_REPO}', revision='{HF_REVISION}', "
            f"local_dir='{MODEL_DIR}', allow_patterns=['{TRANSFORMER_FILE}'])"
            "\"",
            secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
        )
        # Gemma 4 12B text encoder + projections (26GB). Tokenizer and config are
        # embedded in the safetensors file.
        .run_commands(
            "python -c \""
            "from huggingface_hub import snapshot_download; "
            f"snapshot_download('{HF_REPO}', revision='{HF_REVISION}', "
            f"local_dir='{MODEL_DIR}', allow_patterns=['{TEXT_ENCODER_FILE}'])"
            "\"",
            secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
        )
        # Distilled LoRA (8.9GB) + spatial upsampler (1GB) + video/audio VAEs (1.8GB)
        .run_commands(
            "python -c \""
            "from huggingface_hub import snapshot_download; "
            f"snapshot_download('{HF_REPO}', revision='{HF_REVISION}', "
            f"local_dir='{MODEL_DIR}', "
            f"allow_patterns=['{DISTILLED_LORA_FILE}', '{SPATIAL_UPSAMPLER_FILE}', "
            f"'{VIDEO_VAE_FILE}', '{AUDIO_VAE_FILE}'])"
            "\"",
            secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
        )
        # Bake style LoRAs (~500MB each). One hf_hub_download per entry so each
        # LoRA lives at /models/loras/<key>/<filename> and swaps are cheap.
        .run_commands(
            *[
                "python -c \""
                "from huggingface_hub import hf_hub_download; "
                f"hf_hub_download(repo_id='{meta['repo']}', "
                f"filename='{meta['filename']}', "
                f"local_dir='{LORA_DIR}/{key}')"
                "\""
                for key, meta in AVAILABLE_LORAS.items()
            ],
        )
    )


# Build the container image with all dependencies + baked weights. Only the
# deployed version's builder runs, so the other image is never built.
image = _image_23() if LTX2_VERSION == "2.3" else _image_25()

# The container re-imports this file, so a non-default LTX2_VERSION must be in
# the image env, or the re-import would fall back to 2.3 inside a 2.5 image.
# Nothing is added for 2.3, so its image stays identical to earlier deploys.
image_env = {"PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True"}
if LTX2_VERSION != "2.3":
    image_env["LTX2_VERSION"] = LTX2_VERSION
if HF_SECRET_NAME != "huggingface-token":
    image_env["HF_SECRET_NAME"] = HF_SECRET_NAME


@app.cls(
    image=image.env(image_env),
    gpu="A100-80GB",
    timeout=900,
    scaledown_window=60,
    secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
)
@modal.concurrent(max_inputs=1)
class LTX2:
    """LTX-2 video generation: LTX-2.3, or LTX-2.5 when deployed with LTX2_VERSION=2.5."""

    @modal.enter()
    def load_pipeline(self):
        """Load the base LTX-2 pipeline when the container starts."""
        import torch

        print(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            print(f"GPU: {props.name}, VRAM: {props.total_memory // (1024**3)}GB")

        if LTX2_VERSION == "2.3":
            self._find_weights_23()
        else:
            self._find_weights_25()

        self.pipeline = None
        self._current_style_lora = None
        self._build_pipeline(style_lora=None)

    def _find_weights_23(self):
        """Locate the LTX-2.3 checkpoint, distilled LoRA and upsampler."""
        import glob
        import os

        def find_file(pattern):
            matches = glob.glob(os.path.join(MODEL_DIR, pattern))
            return matches[0] if matches else None

        self._checkpoint = find_file("ltx-2.3-22b-dev.safetensors")
        self._distilled_lora_path = find_file("ltx-2.3-22b-distilled-lora-*.safetensors")
        self._spatial_upsampler = find_file("ltx-2.3-spatial-upscaler-x2-1.1.safetensors")

        if not self._checkpoint:
            raise RuntimeError(
                f"LTX-2.3 checkpoint not found in {MODEL_DIR}. "
                f"Files: {os.listdir(MODEL_DIR)}"
            )

        print(f"  Checkpoint: {self._checkpoint}")
        print(f"  Distilled LoRA: {self._distilled_lora_path}")
        print(f"  Spatial upsampler: {self._spatial_upsampler}")
        print(f"  Gemma: {GEMMA_DIR}")

    def _find_weights_25(self):
        """Check the LTX-2.5 split weights and read the checkpoint's guidance defaults."""
        import logging
        import os

        from ltx_pipelines.utils.constants import detect_params
        from ltx_pipelines.utils.model_paths import ModelPaths

        # ltx logs "Checkpoint declares model_version=..." at INFO. That version
        # picks the image-to-video conditioning CRF (18 for 2.4 and later, 33 if
        # the metadata is missing), so show ltx's INFO logs. A handler of their
        # own, rather than basicConfig, so Modal's own log lines aren't doubled.
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
        for name in ("ltx_core", "ltx_pipelines"):
            ltx_logger = logging.getLogger(name)
            ltx_logger.setLevel(logging.INFO)
            if not ltx_logger.handlers:
                ltx_logger.addHandler(handler)
            ltx_logger.propagate = False

        paths = {
            name: os.path.join(MODEL_DIR, rel)
            for name, rel in {
                "transformer": TRANSFORMER_FILE,
                "distilled_lora": DISTILLED_LORA_FILE,
                "spatial_upsampler": SPATIAL_UPSAMPLER_FILE,
                "video_vae": VIDEO_VAE_FILE,
                "audio_vae": AUDIO_VAE_FILE,
                "text_encoder": TEXT_ENCODER_FILE,
            }.items()
        }
        missing = [p for p in paths.values() if not os.path.exists(p)]
        if missing:
            raise RuntimeError(f"LTX-2.5 weights missing from {MODEL_DIR}: {missing}")

        for name, path in paths.items():
            print(f"  {name}: {path}")

        # No duration head: requests always pass num_frames explicitly.
        self._model_paths = ModelPaths.from_split(
            transformer_path=paths["transformer"],
            text_encoder_path=paths["text_encoder"],
            video_vae_path=paths["video_vae"],
            audio_vae_path=paths["audio_vae"],
        )
        self._distilled_lora_path = paths["distilled_lora"]
        self._spatial_upsampler = paths["spatial_upsampler"]
        # Guidance defaults for this checkpoint's generation (CFG/STG scales,
        # STG block), read from its metadata the same way the upstream CLI does.
        self._params = detect_params(paths["transformer"])

    def _build_pipeline(self, style_lora):
        """Construct the pipeline with an optional style LoRA key.

        Called at cold start (no style LoRA) and on per-request style swaps.
        At both pinned LTX-2 versions, construction only sets up the stages:
        weights load per stage during each request and are freed after it, so
        a rebuild mostly swaps the LoRA set. The previous pipeline is released
        first all the same.
        """
        import gc
        import os
        import time

        import torch

        from ltx_core.loader import LTXV_LORA_COMFY_RENAMING_MAP, LoraPathStrengthAndSDOps
        from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline

        if self.pipeline is not None:
            print(f"Releasing current pipeline (style_lora={self._current_style_lora})")
            del self.pipeline
            self.pipeline = None
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        distilled = []
        if self._distilled_lora_path:
            distilled = [
                LoraPathStrengthAndSDOps(
                    self._distilled_lora_path, 0.8, LTXV_LORA_COMFY_RENAMING_MAP
                )
            ]

        style_loras = []
        if style_lora:
            meta = AVAILABLE_LORAS[style_lora]
            lora_path = os.path.join(LORA_DIR, style_lora, meta["filename"])
            if not os.path.exists(lora_path):
                raise RuntimeError(f"Style LoRA file missing: {lora_path}")
            style_loras = [
                LoraPathStrengthAndSDOps(
                    lora_path, meta["strength"], LTXV_LORA_COMFY_RENAMING_MAP
                )
            ]
            print(f"  Style LoRA: {style_lora} @ strength {meta['strength']}")

        print(f"Building pipeline (style_lora={style_lora})...")
        start = time.time()
        if LTX2_VERSION == "2.3":
            self.pipeline = TI2VidTwoStagesPipeline(
                checkpoint_path=self._checkpoint,
                distilled_lora=distilled,
                spatial_upsampler_path=self._spatial_upsampler,
                gemma_root=GEMMA_DIR,
                loras=style_loras,
            )
        else:
            # bf16 weights, no offload: on A100-80GB the stages load one at a
            # time (Gemma 4 ~26GB, then the 42GB transformer per stage), so peak
            # VRAM is one transformer plus activations, not the sum of the
            # components.
            self.pipeline = TI2VidTwoStagesPipeline(
                model_paths=self._model_paths,
                distilled_lora=distilled,
                spatial_upsampler_path=self._spatial_upsampler,
                loras=style_loras,
            )
        self._current_style_lora = style_lora
        print(f"Pipeline loaded in {time.time() - start:.1f}s")

    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: dict) -> dict:
        """Generate video from text prompt (and optional image)."""
        import base64
        import io
        import random
        import shutil
        import tempfile
        import time
        import uuid

        import torch
        from PIL import Image

        prompt = request.get("prompt")
        if not prompt:
            return {"error": "Missing required 'prompt' field"}

        negative_prompt = request.get(
            "negative_prompt",
            "worst quality, inconsistent motion, blurry, jittery, distorted, "
            "watermark, text, logo",
        )

        # Video parameters
        width = request.get("width", 768)
        height = request.get("height", 512)
        num_frames = request.get("num_frames", 121)
        fps = request.get("fps", 24)
        num_inference_steps = request.get("num_inference_steps", 30)
        seed = request.get("seed")
        quality = request.get("quality", "standard")
        r2_config = request.get("r2")

        # Optional style LoRA. Rebuild the pipeline only when the requested
        # LoRA differs from what's currently loaded.
        style_lora = request.get("lora")
        if style_lora and style_lora not in AVAILABLE_LORAS:
            return {
                "error": f"Unknown LoRA '{style_lora}'. "
                f"Available: {list(AVAILABLE_LORAS) or '(none)'}"
            }
        if style_lora != self._current_style_lora:
            self._build_pipeline(style_lora=style_lora)

        # Enforce dimension constraints
        width = (width // 64) * 64
        height = (height // 64) * 64
        # Only on 2.5, so the default 2.3 path behaves exactly as before.
        if LTX2_VERSION == "2.5" and (width < 64 or height < 64):
            return {"error": "width and height must each be at least 64"}

        # Enforce frame count constraint: (num_frames - 1) % 8 == 0
        if (num_frames - 1) % 8 != 0:
            # Round to nearest valid frame count
            num_frames = ((num_frames - 1 + 4) // 8) * 8 + 1

        if seed is None:
            seed = random.randint(0, 2**32 - 1)

        # Fast mode: fewer steps
        if quality == "fast":
            num_inference_steps = min(num_inference_steps, 15)

        # Decode input image for I2V — pipeline expects file paths on disk
        images = []
        image_base64 = request.get("image_base64")
        image_url = request.get("image_url")

        work_dir = tempfile.mkdtemp(prefix="ltx2_")

        if image_base64 or image_url:
            try:
                if image_url:
                    import requests as req

                    resp = req.get(image_url, timeout=60)
                    resp.raise_for_status()
                    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
                else:
                    b64 = image_base64
                    if "," in b64:
                        b64 = b64.split(",", 1)[1]
                    img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")

                # Save to disk — pipeline loads images from file paths
                import os

                img_path = os.path.join(work_dir, "input.png")
                img.save(img_path)

                if LTX2_VERSION == "2.3":
                    from ltx_pipelines.utils.args import ImageConditioningInput

                    images = [
                        ImageConditioningInput(
                            path=img_path,
                            frame_idx=0,
                            strength=0.8,
                            crf=0,  # lossless — no H.264 preprocessing
                        )
                    ]
                else:
                    # At the 2.5 pin ImageConditioningInput lives in utils.types.
                    # crf left unset: the pipeline re-compresses the image at the
                    # CRF this checkpoint was trained with (from its metadata).
                    from ltx_pipelines.utils.types import ImageConditioningInput

                    images = [
                        ImageConditioningInput(
                            path=img_path,
                            frame_idx=0,
                            strength=0.8,
                        )
                    ]
            except Exception as e:
                return {"error": f"Failed to decode input image: {e}"}
        start_time = time.time()

        try:
            import os

            output_path = os.path.join(work_dir, "output.mp4")

            render = self._render_23 if LTX2_VERSION == "2.3" else self._render_25
            num_frames = render(
                prompt=prompt,
                negative_prompt=negative_prompt,
                seed=seed,
                height=height,
                width=width,
                num_frames=num_frames,
                fps=fps,
                num_inference_steps=num_inference_steps,
                images=images,
                output_path=output_path,
            )

            elapsed_ms = int((time.time() - start_time) * 1000)
            duration = num_frames / fps

            result = {
                "success": True,
                "seed": seed,
                "duration": round(duration, 2),
                "width": width,
                "height": height,
                "num_frames": num_frames,
                "fps": fps,
                "inference_time_ms": elapsed_ms,
                "model": HF_REPO,
            }

            # Upload to R2 or return as base64
            if r2_config:
                try:
                    import boto3
                    from botocore.config import Config

                    client = boto3.client(
                        "s3",
                        endpoint_url=r2_config["endpoint_url"],
                        aws_access_key_id=r2_config["access_key_id"],
                        aws_secret_access_key=r2_config["secret_access_key"],
                        config=Config(signature_version="s3v4"),
                    )
                    object_key = f"ltx2/results/{uuid.uuid4().hex[:12]}.mp4"
                    client.upload_file(
                        output_path,
                        r2_config["bucket_name"],
                        object_key,
                        ExtraArgs={"ContentType": "video/mp4"},
                    )
                    presigned_url = client.generate_presigned_url(
                        "get_object",
                        Params={
                            "Bucket": r2_config["bucket_name"],
                            "Key": object_key,
                        },
                        ExpiresIn=7200,
                    )
                    result["output_url"] = presigned_url
                    result["r2_key"] = object_key
                except Exception as e:
                    print(f"R2 upload error: {e}")
                    # Fall back to base64
                    with open(output_path, "rb") as f:
                        result["video_base64"] = base64.b64encode(f.read()).decode(
                            "utf-8"
                        )
            else:
                print(
                    "Warning: Returning video as base64 (use R2 for large files)"
                )
                with open(output_path, "rb") as f:
                    result["video_base64"] = base64.b64encode(f.read()).decode(
                        "utf-8"
                    )

            return result

        except torch.cuda.OutOfMemoryError as e:
            torch.cuda.empty_cache()
            return {
                "error": f"GPU out of memory: {e}. Try smaller dimensions or fewer frames."
            }
        except Exception as e:
            import traceback

            print(f"Error: {e}")
            print(traceback.format_exc())
            return {"error": f"Internal error: {str(e)}"}
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def _render_23(self, prompt, negative_prompt, seed, height, width, num_frames,
                   fps, num_inference_steps, images, output_path):
        """Run LTX-2.3 and write the MP4. Returns the number of frames rendered."""
        import torch

        from ltx_core.components.guiders import MultiModalGuiderParams
        from ltx_pipelines.utils.media_io import encode_video

        video_guider = MultiModalGuiderParams(
            cfg_scale=3.0,
            stg_scale=1.0,
            rescale_scale=0.7,
            modality_scale=3.0,
            stg_blocks=[28],
        )
        audio_guider = MultiModalGuiderParams(
            cfg_scale=7.0,
            stg_scale=1.0,
            rescale_scale=0.7,
            modality_scale=3.0,
            stg_blocks=[28],
        )

        print(
            f"Generating: {width}x{height}, {num_frames} frames, "
            f"{num_inference_steps} steps, seed={seed}"
        )

        # CRITICAL: torch.inference_mode() prevents PyTorch from retaining
        # the autograd graph. Without it, the Gemma text encoder's ~37GB of
        # activations stay in VRAM even after del, causing OOM when the
        # transformer loads. This is a known issue (GitHub #152) — the
        # pipeline's __call__ doesn't set inference_mode, but the CLI does.
        # The scope must include encode_video() because the pipeline returns
        # a lazy iterator — frames are decoded when the iterator is consumed.
        with torch.inference_mode():
            video_iter, audio = self.pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                seed=seed,
                height=height,
                width=width,
                num_frames=num_frames,
                frame_rate=float(fps),
                num_inference_steps=num_inference_steps,
                video_guider_params=video_guider,
                audio_guider_params=audio_guider,
                images=images if images else [],
            )

            encode_video(
                video=video_iter,
                fps=fps,
                audio=audio,
                output_path=output_path,
                video_chunks_number=1,
            )

        return num_frames

    def _render_25(self, prompt, negative_prompt, seed, height, width, num_frames,
                   fps, num_inference_steps, images, output_path):
        """Run LTX-2.5 and write the MP4. Returns the number of frames rendered."""
        import torch

        from ltx_core.model.video_vae import get_video_chunks_number
        from ltx_pipelines.utils.media_io import encode_video

        print(
            f"Generating: {width}x{height}, {num_frames} frames, "
            f"{num_inference_steps} steps, seed={seed}"
        )

        # Same inference_mode scope as _render_23, for the same reasons. The
        # guidance comes from the checkpoint's metadata (detect_params at
        # startup), and the pipeline returns a PipelineOutput.
        with torch.inference_mode():
            result = self.pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                seed=seed,
                height=height,
                width=width,
                num_frames=num_frames,
                frame_rate=float(fps),
                num_inference_steps=num_inference_steps,
                video_guider_params=self._params.video_guider_params,
                audio_guider_params=self._params.audio_guider_params,
                images=images,
            )

            encode_video(
                video=result.video,
                fps=fps,
                audio=result.audio,
                output_path=output_path,
                video_chunks_number=get_video_chunks_number(
                    result.num_frames, result.tiling_config
                ),
            )

        return result.num_frames
