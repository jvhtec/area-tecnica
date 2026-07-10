export type HtmlSanitizer = (
  dirty: string,
  options?: Record<string, unknown>,
) => string;

const ALLOWED_TAGS = [
  "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "hr",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "a", "img",
];

/** Sanitizes caller-provided corporate-email HTML at the server boundary. */
export function sanitizeCorporateEmailHtml(
  dirtyHtml: string,
  sanitize: HtmlSanitizer,
  approvedInlineImagePrefix: string,
): string {
  return sanitize(dirtyHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan", "align"],
      th: ["colspan", "rowspan", "align", "scope"],
      table: ["role", "width", "cellspacing", "cellpadding"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame: { tag: string; attribs: Record<string, string> }) => (
      frame.tag === "img" &&
      (!frame.attribs.src || !frame.attribs.src.startsWith(approvedInlineImagePrefix))
    ),
    transformTags: {
      a: (_tagName: string, attribs: Record<string, string>) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}

