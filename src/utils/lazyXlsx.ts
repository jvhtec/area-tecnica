let xlsxPromise: Promise<typeof import('xlsx')> | null = null;

export async function loadXlsx() {
  xlsxPromise ??= import('xlsx');
  return await xlsxPromise;
}

