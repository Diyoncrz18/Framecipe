// Indonesian UI labels for statuses, stages, phases and event types. No imports: safe for client components.
export const DISPLAY_STATUSES = ['running', 'waiting', 'waiting-permission', 'stopped', 'success', 'failed', 'cancelled', 'abandoned'];

export const STATUS_LABELS = {
  running: 'Berjalan',
  waiting: 'Menunggu Anda',
  'waiting-permission': 'Menunggu izin Anda',
  stopped: 'Claude berhenti',
  success: 'Sukses',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
  abandoned: 'Terhenti',
};

export const STAGE_LABELS = {
  setup: 'Persiapan', script: 'Naskah', assets: 'Aset', audio: 'Audio', compose: 'Komposisi',
  qc: 'QC', render: 'Render', review: 'Review visual', done: 'Selesai',
};

export const SOURCE_KIND_LABELS = { video: 'Video', audio: 'Audio', image: 'Gambar', text: 'Teks' };

export const PHASE_LABELS = {
  planning: 'Perencanaan', assets: 'Aset', audio: 'Audio', editing: 'Penyuntingan', rendering: 'Render', complete: 'Selesai',
};

export const EVENT_LABELS = {
  prompt: 'Prompt', skill: 'Skill', command: 'Perintah', file: 'File', agent: 'Subagent', tool: 'Tool',
  notification: 'Notifikasi', stop: 'Berhenti', 'session-start': 'Sesi mulai', 'session-end': 'Sesi selesai', stage: 'Tahap',
};
