/**
 * Small helper for building DOM nodes without innerHTML, so names and openings
 * coming from Chess.com / Lichess can never inject HTML.
 *
 *   el("div", { className: "row", onclick: fn }, "text", childNode)
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "className" || key === "textContent" || key === "hidden") node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

/** For the few places that still build HTML strings: makes text safe to insert. */
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Only allow normal web links, never javascript: or data: URLs coming from an API. */
export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export const IMG = "./img";
