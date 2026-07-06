// Mobile: true fullscreen (matches ArtistManagementDialog's convention). Desktop:
// w-96vw/h-85vh — matches what dialog.tsx's own base classes actually allow
// (md:max-h-[85vh]), so the two don't fight over the box's rendered height.
export const getHojaDeRutaDialogClassName = (isMobile: boolean): string =>
  isMobile
    ? "flex h-dvh max-h-dvh w-[100vw] max-w-[100vw] flex-col gap-0 overflow-hidden rounded-none p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    : "flex w-[96vw] max-w-[96vw] h-[85vh] max-h-[85vh] flex-col gap-0 overflow-hidden p-0";
