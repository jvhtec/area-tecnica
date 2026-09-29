import type { FormLanguage } from "./links";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/** Splits a free-text recipient list (commas, semicolons or new lines) into unique addresses. */
export const parseRecipientEmails = (value: string): string[] => [
  ...new Set(
    value
      .split(/[,\n;]+/)
      .map((email) => email.trim())
      .filter(Boolean),
  ),
];

/** The QR image travels inline (`cid:`) rather than as a remote image, so mail clients render it. */
export const QR_CONTENT_ID = "artist_form_qr";

/** Splits a `data:` URL into what the email function expects for an inline image. */
export function toInlineQrImage(dataUrl: string, artistName: string) {
  if (!dataUrl.startsWith("data:")) return [];
  const [meta, content] = dataUrl.split(",", 2);
  const mimeType = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  return [
    {
      cid: QR_CONTENT_ID,
      content,
      mimeType,
      filename: `artist-form-${artistName || "artist"}.png`,
    },
  ];
}

const SUPPORT_FOOTER = {
  en: `<p style="font-size:12px;color:#6b7280;">
          This is an automated email. Please do not reply. For any issues, contact the festival technical office at
          <a href="mailto:sonido@sector-pro.com">sonido@sector-pro.com</a>.
        </p>`,
  es: `<p style="font-size:12px;color:#6b7280;">
          Este correo es automático. Por favor, no respondas a este email. Si tienes incidencias, contacta con la oficina técnica del festival en
          <a href="mailto:sonido@sector-pro.com">sonido@sector-pro.com</a>.
        </p>`,
} satisfies Record<FormLanguage, string>;

const COPY = {
  en: {
    subject: (name: string) => `Technical form - ${name}`,
    greeting: "Hello,",
    intro: (name: string) =>
      `You can complete the technical form for <strong>${name}</strong> using the button below.`,
    button: "Click here to fill the form",
    qrIntro: "You can also scan this QR code:",
    qrAlt: "Artist form QR",
    attachment: "We have also attached a printable blank template for this artist.",
  },
  es: {
    subject: (name: string) => `Formulario técnico - ${name}`,
    greeting: "Hola,",
    intro: (name: string) =>
      `Puedes completar el formulario técnico de <strong>${name}</strong> usando el botón de abajo.`,
    button: "Haz clic aquí para completar el formulario",
    qrIntro: "También puedes escanear este código QR:",
    qrAlt: "QR formulario artista",
    attachment: "Adjuntamos también la plantilla imprimible en blanco para este artista.",
  },
} satisfies Record<FormLanguage, unknown>;

/** Subject and HTML body of the email that sends an artist their technical form. */
export function buildArtistFormEmail({
  language,
  artistName,
  formLink,
}: {
  language: FormLanguage;
  artistName: string;
  formLink: string;
}): { subject: string; bodyHtml: string } {
  const copy = COPY[language];
  const safeName = escapeHtml(artistName);
  // The link is built from a token we issued, but it is escaped like any value put in an attribute.
  const safeLink = escapeHtml(formLink);

  const bodyHtml = `
        <p>${copy.greeting}</p>
        <p>${copy.intro(safeName)}</p>
        <p>
          <a
            href="${safeLink}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;padding:10px 16px;border-radius:6px;background:#7d0101;color:#ffffff;text-decoration:none;font-weight:600;"
          >
            ${copy.button}
          </a>
        </p>
        <p>${copy.qrIntro}</p>
        <p><img src="cid:${QR_CONTENT_ID}" alt="${copy.qrAlt}" style="max-width:220px;height:auto;" /></p>
        <p>${copy.attachment}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        ${SUPPORT_FOOTER[language]}
      `;

  return { subject: copy.subject(artistName), bodyHtml };
}
