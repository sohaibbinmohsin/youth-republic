// Escapes a string for safe interpolation into an HTML email body. Any
// user-controlled value (a volunteer's name, an opportunity's name/
// description, a rejection reason, etc.) that ends up inside an HTML
// template must go through this first — otherwise a value like
// `<img src=x onerror=...>` in a volunteer's own profile gets sent back to
// them (or to staff) as live, rendering HTML.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
