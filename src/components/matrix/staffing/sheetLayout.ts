/**
 * Shared body/footer layout for the matrix's staffing dialogs.
 *
 * On a phone these render as bottom sheets whose own container scrolls, so the
 * body must NOT cap its height (two nested scroll areas cut rows off mid-text)
 * and the footer sticks to the bottom of that scroll so the CTA is always
 * reachable. On desktop the dialog does not scroll by itself, so there the body
 * takes the cap and the footer goes back to being an ordinary row.
 */

export const SHEET_BODY =
  'px-4 py-1 sm:max-h-[55vh] sm:overflow-y-auto sm:px-0';

export const SHEET_FOOTER =
  'sticky bottom-0 z-10 gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur ' +
  'sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none';

/**
 * Sticky on mobile so the sheet's own close button never ends up floating over
 * scrolled content — it stays over the title, where it belongs.
 */
export const SHEET_HEADER =
  'sticky top-0 z-10 bg-background/95 px-4 pb-2 pt-2 text-left backdrop-blur ' +
  'sm:static sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-none';
