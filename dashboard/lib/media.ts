// `repoRelPath` is repo-relative with `/` separators; the /api/media route resolves it through resolveInside().
export function mediaUrl(repoRelPath: string, opts?: { download?: boolean }): string {
  const encoded = repoRelPath.split("/").map(encodeURIComponent).join("/");
  return `/api/media/${encoded}${opts?.download ? "?download=1" : ""}`;
}
