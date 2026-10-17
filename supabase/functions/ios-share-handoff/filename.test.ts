import { describe, expect, it } from 'vitest'

import { hasUnsafeFileNameCharacter, isValidFileName, sanitizeFileName } from './filename'

describe('isValidFileName', () => {
  it('keeps unknown, Unicode and extensionless names exactly', () => {
    for (const name of ['rider.xyz123', 'Plano güiro ñ 日本.pdf', 'sin extension', 'a.b.c.tar.gz']) {
      expect(isValidFileName(name)).toBe(true)
    }
  })

  it('rejects empty, dot, separators, control characters and overlong names', () => {
    for (const name of ['', '.', '..', 'a/b', 'a\\b', 'a\u0000b', 'a\nb', 'a\u007fb', 'x'.repeat(256)]) {
      expect(isValidFileName(name)).toBe(false)
    }
    expect(isValidFileName('x'.repeat(255))).toBe(true)
  })
})

describe('hasUnsafeFileNameCharacter', () => {
  it('flags path separators and control characters only', () => {
    expect(hasUnsafeFileNameCharacter('a/b')).toBe(true)
    expect(hasUnsafeFileNameCharacter('a\\b')).toBe(true)
    expect(hasUnsafeFileNameCharacter('a\tb')).toBe(true)
    expect(hasUnsafeFileNameCharacter('ñandú 日本 😀.pdf')).toBe(false)
  })
})

describe('sanitizeFileName', () => {
  it('replaces separators and control characters with underscores', () => {
    expect(sanitizeFileName('a/b\\c\u0000d.pdf')).toBe('a_b_c_d.pdf')
  })

  it('trims, normalizes to NFC and caps at 255 characters', () => {
    expect(sanitizeFileName('  informe.pdf  ')).toBe('informe.pdf')
    expect(sanitizeFileName('café.pdf')).toBe('café.pdf')
    expect(sanitizeFileName('x'.repeat(300))).toHaveLength(255)
  })

  it('does not double-decode a literal percent sequence', () => {
    expect(sanitizeFileName('100%2Fdone.pdf')).toBe('100%2Fdone.pdf')
  })

  it('yields something isValidFileName accepts, or an empty string for the caller to replace', () => {
    expect(isValidFileName(sanitizeFileName('../../etc/passwd'))).toBe(true)
    expect(sanitizeFileName('   ')).toBe('')
  })
})
