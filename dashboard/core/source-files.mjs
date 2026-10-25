// What a video request may bring along as source files. No imports: the request form runs this in the browser.
export const SOURCE_EXTENSIONS = {
  video: ['mp4', 'mov', 'webm', 'mkv', 'm4v'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
  text: ['txt', 'md', 'srt', 'vtt', 'csv', 'json'],
};
export const SOURCE_KINDS = Object.keys(SOURCE_EXTENSIONS);
export const MAX_SOURCE_BYTES = 2 * 1024 ** 3; // a long 1080p recording
export const MAX_SOURCE_FILES = 20;
export const SOURCE_ACCEPT = Object.values(SOURCE_EXTENSIONS).flat().map((e) => `.${e}`).join(',');

// 'video' | 'audio' | 'image' | 'text' by extension, or null for a type a request does not take.
export function sourceKind(name) {
  const ext = /\.([^.]+)$/.exec(String(name))?.[1].toLowerCase();
  return SOURCE_KINDS.find((k) => SOURCE_EXTENSIONS[k].includes(ext)) ?? null;
}
