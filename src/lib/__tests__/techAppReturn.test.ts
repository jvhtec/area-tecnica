// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DOCUMENT_RETURN_TTL_MS,
  clearDocumentReturn,
  consumeDocumentReturn,
  rememberDocumentReturn,
} from '@/lib/techAppReturn';

const docsLocation = { pathname: '/tech-app', search: '?tab=jobs&open=details&jobId=job-1&detailsTab=Docs' };

describe('tech app document return point', () => {
  beforeEach(() => window.localStorage.clear());

  it('restores the exact tech-app location once', () => {
    rememberDocumentReturn(docsLocation, 1_000);
    expect(consumeDocumentReturn(2_000)).toBe('/tech-app?tab=jobs&open=details&jobId=job-1&detailsTab=Docs');
    expect(consumeDocumentReturn(3_000)).toBeNull();
  });

  it('expires so a later normal launch is not hijacked', () => {
    rememberDocumentReturn(docsLocation, 0);
    expect(consumeDocumentReturn(DOCUMENT_RETURN_TTL_MS + 1)).toBeNull();
  });

  it('is cleared when the technician is back in the live app', () => {
    rememberDocumentReturn(docsLocation, 0);
    clearDocumentReturn();
    expect(consumeDocumentReturn(1)).toBeNull();
  });

  it('only records tech-app locations and ignores tampered values', () => {
    rememberDocumentReturn({ pathname: '/technician-dashboard', search: '' }, 0);
    expect(consumeDocumentReturn(1)).toBeNull();

    window.localStorage.setItem('tech-app:document-return', JSON.stringify({ path: '//evil.example', savedAt: 0 }));
    expect(consumeDocumentReturn(1)).toBeNull();
    window.localStorage.setItem('tech-app:document-return', 'not json');
    expect(consumeDocumentReturn(1)).toBeNull();
  });
});
