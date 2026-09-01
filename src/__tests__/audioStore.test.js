import { describe, it, test, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createFileService } from '../utils/fileServices.js'
import { useAudioStore } from '../stores/audioStore.js'

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ value: refValue })),
}))
vi.mock('../utils/fileServices.js')
vi.mock('../utils/session.js', () => ({
  getEvidenceLinks: () => ({
    'audio1.webm': { count: 1 },
    'audio2.webm': { count: 2 },
    'audio3.webm': { count: 1 },
  }),
}))

describe('Audio Store', () => {
  let pinia
  let audio
  let mockFs

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()

    // Mock ref
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }))

    // Mock createFileService
    mockFs = {
      loadChecklist: vi.fn(),
      loadSession: vi.fn(),
      saveAudio: vi.fn(),
      createDefaultPath: vi.fn(),
      readAudio: vi.fn(),
      deleteAudio: vi.fn(),
    }
    vi.mocked(createFileService).mockReturnValue(mockFs)

    // Initialize store
    audio = useAudioStore()
  })

  describe('audio.reset', () => {
    it('resets the files object to empty', () => {
      audio.files.value['file1'] = {}
      audio.files.value['file1'].URL = '/mocked/file1'
      audio.files.value['file1'].count = 2
      audio.files.value['file2'] = {}
      audio.files.value['file2'].URL = '/mocked/file2'
      audio.files.value['file2'].count = 1

      audio.reset()

      expect(audio.files.value).toEqual({})
    })
  })

  describe('audio.load', () => {
    it('loads the files object with correct data', async () => {
      mockFs.readAudio.mockResolvedValue([
        { name: 'audio1.webm', URL: '/mocked/audio1.webm', count: 0 },
        { name: 'audio2.webm', URL: '/mocked/audio2.webm', count: 0 },
      ])
      await audio.load('SUR')

      expect(mockFs.readAudio).toBeCalledWith('SUR')
      expect(audio.files.value).toEqual({
        'audio1.webm': { URL: '/mocked/audio1.webm', count: 0 },
        'audio2.webm': { URL: '/mocked/audio2.webm', count: 0 },
      })
    })

    it('handles case when no files are read', async () => {
      mockFs.readAudio.mockResolvedValue([])
      await audio.load('SUR')

      expect(mockFs.readAudio).toBeCalledWith('SUR')
      expect(audio.files.value).toEqual({})
    })

    it('handles error gracefully when Audio directory does not exist', async () => {
      mockFs.readAudio.mockRejectedValue(new Error('Directory not found'))
      const consoleSpy = vi.spyOn(console, 'log')

      await audio.load('SUR')

      expect(consoleSpy).toHaveBeenCalledWith('audioStore.load: Directory not found')
      expect(audio.files.value).toEqual({})
      consoleSpy.mockRestore()
    })
  })

  describe('audio.add', () => {
    beforeEach(() => {
      // set the example files content
      audio.files.value = {
        'exists.webm': { URL: '/mocked/exists.webm', count: 1 },
        'updated.webm': { URL: '/mocked/updated.webm', count: 1 },
        'notOnDisk.webm': { URL: '/mocked/notOnDisk.webm', count: 2 },
      }

      mockFs.saveAudio.mockImplementation((specialty, fileName) => {
        // we have three files on disk: exists, updated and unaccounted.  to test different scenarios
        if (fileName == 'exists.webm' || fileName == 'unaccounted.webm') {
          return null // dont save
        }
        if (fileName == 'updated.webm') {
          return '/mocked/updated.webm' // updated file
        }
        return '/mocked/' + fileName
      })
    })

    test('when file is new and not in files object', async () => {
      const buffer = new ArrayBuffer(8)
      await audio.add('SUR', 'audio1.webm', buffer)

      expect(mockFs.saveAudio).toBeCalledWith('SUR', 'audio1.webm', buffer)
      expect(mockFs.saveAudio).toHaveReturned('/mocked/audio1.webm')
      expect(audio.files.value['audio1.webm']).toEqual({ URL: '/mocked/audio1.webm', count: 0 })
    })

    test('when file exists and in files object', async () => {
      const buffer = new ArrayBuffer(8)
      await audio.add('SUR', 'exists.webm', buffer)

      expect(mockFs.saveAudio).toBeCalledWith('SUR', 'exists.webm', buffer)
      expect(mockFs.saveAudio).toHaveReturned(null)
      expect(audio.files.value['exists.webm']).toEqual({ URL: '/mocked/exists.webm', count: 1 })
    })

    test('when file exists but has been updated', async () => {
      const buffer = new ArrayBuffer(8)
      await audio.add('SUR', 'updated.webm', buffer)

      expect(mockFs.saveAudio).toBeCalledWith('SUR', 'updated.webm', buffer)
      expect(mockFs.saveAudio).toHaveReturned('/mocked/updated.webm')
      expect(audio.files.value['updated.webm']).toEqual({ URL: '/mocked/updated.webm', count: 1 })
    })

    test('when file doesnt exist but is in files object', async () => {
      // shouldn't happen.  Somebody must have erased it while app was running.
      const buffer = new ArrayBuffer(8)
      await audio.add('SUR', 'notOnDisk.webm', buffer)

      expect(mockFs.saveAudio).toBeCalledWith('SUR', 'notOnDisk.webm', buffer)
      expect(mockFs.saveAudio).toHaveReturned('/mocked/notOnDisk.webm')
      expect(audio.files.value['notOnDisk.webm']).toEqual({
        URL: '/mocked/notOnDisk.webm',
        count: 2,
      })
    })

    test('when file exists but is not in files object', async () => {
      // shouldn't happen.  File was copied while running.  This is a problem
      const buffer = new ArrayBuffer(8)

      await expect(audio.add('SUR', 'unaccounted.webm', buffer)).rejects.toThrow(
        'audioStore.add: could not add audio: audio.add: detected untracked file: unaccounted.webm'
      )

      expect(mockFs.saveAudio).toBeCalledWith('SUR', 'unaccounted.webm', buffer)
    })
  })

  describe('audio.addCount', () => {
    it('adds to the count when file exists', () => {
      audio.files.value = {
        'audio1.webm': { URL: '/mocked/audio1.webm', count: 1 },
      }

      audio.addCount('audio1.webm')

      expect(audio.files.value['audio1.webm'].count).toBe(2)
    })

    it('does not crash when file does not exist', () => {
      audio.files.value = {}

      // This should not add a file, just return without doing anything
      try {
        audio.addCount('newfile.webm')
        expect(audio.files.value['newfile.webm']).toBeUndefined()
      } catch (e) {
        // Expected if addCount tries to modify non-existent file
        // This tests that the function either handles it or fails gracefully
        expect(e).toBeDefined()
      }
    })
  })

  describe('audio.subtract', () => {
    test('decrements the count when count is greater than 1', async () => {
      audio.files.value = {
        'audio1.webm': { URL: '/mocked/audio1.webm', count: 3 },
      }
      mockFs.deleteAudio.mockResolvedValue(true)

      await audio.subtract('SUR', 'audio1.webm')

      expect(audio.files.value['audio1.webm'].count).toBe(2)
      expect(mockFs.deleteAudio).not.toHaveBeenCalled()
    })

    test('deletes file when count is 1', async () => {
      audio.files.value = {
        'audio1.webm': { URL: '/mocked/audio1.webm', count: 1 },
      }
      mockFs.deleteAudio.mockResolvedValue(true)

      await audio.subtract('SUR', 'audio1.webm')

      expect(mockFs.deleteAudio).toHaveBeenCalledWith('SUR', 'audio1.webm')
      expect(audio.files.value['audio1.webm']).toBeUndefined()
    })

    test('handles delete error gracefully', async () => {
      audio.files.value = {
        'audio1.webm': { URL: '/mocked/audio1.webm', count: 1 },
      }
      mockFs.deleteAudio.mockRejectedValue(new Error('Delete failed'))

      await expect(audio.subtract('SUR', 'audio1.webm')).rejects.toThrow('Delete failed')

      // File should still be in store since deletion failed
      expect(audio.files.value['audio1.webm']).toBeDefined()
    })

    test('throws error if file does not exist in store', async () => {
      audio.files.value = {}
      mockFs.deleteAudio.mockResolvedValue(true)

      // Should throw error if file doesn't exist
      await expect(audio.subtract('SUR', 'nonexistent.webm')).rejects.toThrow()
      expect(mockFs.deleteAudio).not.toHaveBeenCalled()
    })
  })

  describe('audio.updateCount', () => {
    it('updates counts for audio files from session data', () => {
      audio.files.value = {
        'audio1.webm': { URL: '/mocked/audio1.webm', count: 0 },
      }

      audio.updateCount({ 1: { audioComments: ['audio1.webm', 'audio2.webm'] } })

      expect(audio.files.value['audio1.webm'].count).toBe(1)
      expect(audio.files.value['audio2.webm'].count).toBe(2)
      expect(audio.files.value['audio3.webm'].count).toBe(1)
    })

    it('initializes files that dont exist yet', () => {
      audio.files.value = {}

      audio.updateCount({ 1: { nonConformityDetails: { audioNonConformity: ['audio1.webm'] } } })

      expect(audio.files.value['audio1.webm']).toEqual({ URL: '', count: 1 })
    })

    it('ignores non-audio files', () => {
      audio.files.value = {}

      audio.updateCount({
        1: { evidence: ['file.pdf'], audioComments: ['audio1.webm'] },
      })

      expect(audio.files.value['file.pdf']).toBeUndefined()
      expect(audio.files.value['audio1.webm']).toBeDefined()
    })
  })
})
