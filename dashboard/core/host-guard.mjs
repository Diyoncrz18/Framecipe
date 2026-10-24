// Which Host headers the dashboard answers to. It only listens on 127.0.0.1:3210, so any other name that reaches it
// (a DNS-rebinding page in the user's browser) is refused before a page, the media route or a server action runs.
export const ALLOWED_HOSTS = ['127.0.0.1:3210', 'localhost:3210'];

export const isAllowedHost = (host) => ALLOWED_HOSTS.includes(String(host ?? '').toLowerCase());
