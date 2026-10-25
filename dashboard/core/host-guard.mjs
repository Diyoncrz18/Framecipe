// Which Host headers the dashboard answers to. It only listens on 127.0.0.1:3210, so any other name that reaches it
// (a DNS-rebinding page in the user's browser) is refused before a page, the media route or a server action runs.
export const ALLOWED_HOSTS = ['127.0.0.1:3210', 'localhost:3210'];

export const isAllowedHost = (host) => ALLOWED_HOSTS.includes(String(host ?? '').toLowerCase());

// For a route handler that takes a POST: unlike a server action it has no built-in check, and a form on any other site can POST here.
// Browsers always send Origin on a POST, so a missing one is refused too.
export function isAllowedOrigin(origin) {
  try {
    const url = new URL(String(origin));
    return url.protocol === 'http:' && isAllowedHost(url.host);
  } catch {
    return false;
  }
}
