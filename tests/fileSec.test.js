import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'node:path'
import { safePath, safeJoin } from '../utils/fileSec.js'

// Mock path module
vi.mock('node:path', { spy: true })

describe('fileSec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('safePath', () => {
    it('returns valid path', () => {
      const result = safePath('/valid/path/file.txt')
      expect(result).toBe('/valid/path/file.txt')
    })

    it('returns as valid just a root path', () => {
      const result = safePath('/')
      expect(result).toBe('/')
    })

    it('throws on path with ..', () => {
      expect(() => safePath('/path/../file.txt')).toThrow(
        'safePath: Illegal path name: /path/../file.txt'
      )
    })

    it('throws on non-string path', () => {
      expect(() => safePath(123)).toThrow('safePath: Illegal path name: 123')
      expect(() => safePath(null)).toThrow('safePath: Illegal path name: null')
      expect(() => safePath(undefined)).toThrow('safePath: Illegal path name: undefined')
    })

    it('throws on string that is not a path', () => {
      expect(() => safePath('This is not a path')).toThrow(
        'safePath: Not absolute path: This is not a path'
      )
    })

    it('throws on empty string', () => {
      expect(() => safePath('')).toThrow('safePath: Empty path detected: ')
    })
  })

  describe('safeJoin', () => {
    it('joins valid path', () => {
      const result = safeJoin('/base', ['sub', 'file.txt'])
      expect(resolve).toHaveBeenCalledWith('/base', 'sub', 'file.txt')
      expect(result).toBe('/base/sub/file.txt')
    })

    it('throws on path traversal', () => {
      expect(() => safeJoin('/base', ['../file.txt'])).toThrow(
        'safeJoin: Illegal path name: /base,../file.txt'
      )
      expect(() => safeJoin('/base/../base2', ['file.txt'])).toThrow(
        'safeJoin: Illegal path name: /base/../base2,file.txt'
      )
    })

    it('handles empty input', () => {
      const result = safeJoin('/base', [''])
      expect(result).toBe('/base')
    })

    it('throws on non-string base', () => {
      expect(() => safeJoin(123, ['sub', 'file.txt'])).toThrow(
        'safeJoin: Illegal path name: 123 ; sub,file.txt'
      )
      expect(() => safeJoin(null, ['sub', 'file.txt'])).toThrow(
        'safeJoin: Illegal path name: null ; sub,file.txt'
      )
      expect(() => safeJoin(undefined, ['sub', 'file.txt'])).toThrow(
        'safeJoin: Illegal path name: undefined ; sub,file.txt'
      )
    })

    it('throws on non-string input', () => {
      expect(() => safeJoin('/base', 123)).toThrow('safeJoin: Illegal path name: /base ; 123')
      expect(() => safeJoin('/base', null)).toThrow('safeJoin: Illegal path name: /base ; null')
      expect(() => safeJoin('/base', undefined)).toThrow(
        'safeJoin: Illegal path name: /base ; undefined'
      )
    })
  })
})
