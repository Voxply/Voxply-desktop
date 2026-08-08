import DOMPurify from "dompurify";

// Shared sanitization for user-supplied SVG markup (hub icon library,
// channel custom icons). DOMPurify's svg/svgFilters profiles strip scripts,
// event handlers, and external references while keeping the shapes.
//
// Deliberately untested here: DOMPurify delegates to the host DOM's parser,
// and happy-dom (the only DOM implementation in this workspace) does not
// implement HTML foreign-content parsing for <svg>. Under it, DOMPurify
// leaves `onload`/`onerror` on SVG children and drops the <svg> root — none
// of which happens in a real browser, where the same call strips them. A
// unit test here would assert happy-dom's parser bugs, not our config. Size
// is bounded server-side (`MAX_SVG_BYTES` in the hub's hub_icons route),
// which is the trust boundary that matters.
export function sanitizeSvgMarkup(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}
