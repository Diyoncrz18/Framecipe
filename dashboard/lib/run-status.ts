// A run in one of these display statuses can still change on its own, so its pages refresh every 2 s.
// abandoned is left out on purpose: the page stops moving until the user marks the run failed or Claude resumes (reload).
const LIVE = new Set(["running", "waiting", "waiting-permission", "stopped"]);

export const isLive = (status: string | null | undefined): boolean => LIVE.has(status ?? "");
