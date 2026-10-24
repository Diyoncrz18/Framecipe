import path from "node:path";

// Repo root: `dashboard/` sits directly under it.
export const ROOT: string = process.env.VIDEO_REPO_ROOT ?? path.resolve(process.cwd(), "..");
