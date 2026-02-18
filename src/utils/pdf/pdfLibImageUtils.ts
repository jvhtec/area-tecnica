import { PDFDocument, PDFImage } from 'pdf-lib';
import { supabase } from '@/lib/supabase';

const getImageTypeHints = (url: string, contentType: string, bytes: Uint8Array) => {
  const isPngByHeader = /png/i.test(contentType);
  const isJpgByHeader = /(jpe?g)/i.test(contentType);
  const isPngByExt = /\.png(\?|$)/i.test(url);
  const isJpgByExt = /\.jpe?g(\?|$)/i.test(url);
  const isPngBySig =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpgBySig =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  return {
    assumePng: isPngByHeader || isPngByExt || isPngBySig,
    assumeJpg: isJpgByHeader || isJpgByExt || isJpgBySig,
  };
};

const fetchWithAuthFallback = async (url: string): Promise<Response> => {
  let response = await fetch(url);
  if (response.ok || response.status !== 401) return response;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return response;

  response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response;
};

export const embedPdfLibImageFromUrl = async (
  pdfDoc: PDFDocument,
  imageUrl?: string,
): Promise<PDFImage | null> => {
  if (!imageUrl) return null;

  const response = await fetchWithAuthFallback(imageUrl);
  if (!response.ok) {
    throw new Error(`Image fetch failed with status ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type') || '';
  const imageData = await response.arrayBuffer();
  const bytes = new Uint8Array(imageData.slice(0, 8));
  const { assumePng, assumeJpg } = getImageTypeHints(imageUrl, contentType, bytes);

  if (assumePng) {
    return await pdfDoc.embedPng(imageData);
  }
  if (assumeJpg) {
    return await pdfDoc.embedJpg(imageData);
  }

  try {
    return await pdfDoc.embedPng(imageData);
  } catch {
    return await pdfDoc.embedJpg(imageData);
  }
};
