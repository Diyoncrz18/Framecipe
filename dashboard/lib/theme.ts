// Shared by the root layout (server) and ThemeToggle (client): a "use client" module could not hand the layout a plain string.
export const THEME_KEY = "framecipe-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Runs in <head> before the first paint, so a dark page never flashes light. Same rule as ThemeToggle's apply(). */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
