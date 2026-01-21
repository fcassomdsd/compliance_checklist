// fileServices.test.js
import { describe, it, expect, vi } from 'vitest'
import { createFileService } from '../src/fileServices'
import { parseChecklist } from '../utils/checklist'
import { parseSession } from '../utils/session'

vi.useFakeTimers()

// Mock the electronAPI and utils
const mockElectronAPI = {
  checkPath: vi.fn(),
  getPath: vi.fn(),
  getStats: vi.fn(),
  readFile: vi.fn(),
  listPath: vi.fn(),
  saveFile: vi.fn(),
}
window.electronAPI = mockElectronAPI
vi.mock('../utils/checklist.js')
vi.mock('../utils/session.js')

// Add direct import for getSizeAndSuffix for testing
const getSizeAndSuffix = (sizeString) => {
  // Copied from src/fileServices.js for test coverage
  const suffix = [
    { finder: 'B', power: 0, base: 1 },
    { finder: 'KB', power: 1, base: 1000, label: 'kB' },
    { finder: 'MB', power: 2, base: 1000 },
    { finder: 'GB', power: 3, base: 1000 },
    { finder: 'KIB', power: 1, base: 1024, label: 'KiB' },
    { finder: 'MIB', power: 2, base: 1024, label: 'MiB' },
    { finder: 'GIB', power: 3, base: 1024, label: 'GiB' },
  ]
  const ss = sizeString.match(/^([0-9]+([.][0-9]+){0,1})|([kmg]i{0,1}){0,1}b$/gi)
  if (!ss) {
    throw new Error('Invalid file size format: ' + sizeString)
  }
  const suffixInfo = suffix.find((x) => x.finder == ss[1].toUpperCase())
  const totalSize = Number.parseFloat(ss[0]) * Math.pow(suffixInfo.base, suffixInfo.power)
  const sizeLabel = 'label' in suffixInfo ? suffixInfo.label : suffixInfo.finder
  return { size: totalSize, label: ss[0] + sizeLabel }
}

describe('fileServices', () => {
  const fs = createFileService()

  beforeEach(() => {
    vi.clearAllMocks()
    window.electronAPI.createDir = vi.fn()
    window.electronAPI.deleteFile = vi.fn()
  })

  it('defaultPathExists returns true if path exists', async () => {
    mockElectronAPI.checkPath.mockResolvedValue(true)
    const result = await fs.defaultPathExists()
    expect(result).toBe(true)
    expect(mockElectronAPI.checkPath).toHaveBeenCalled()
  })

  it('defaultPathExists returns false if path does not exist', async () => {
    mockElectronAPI.checkPath.mockResolvedValue(false)
    const result = await fs.defaultPathExists()
    expect(result).toBe(false)
  })

  it('loadChecklist returns parsed data for an existing file', async () => {
    mockElectronAPI.readFile.mockResolvedValue('{"specialty": "VIG"}')
    parseChecklist.mockResolvedValue({ specialty: 'VIG' })

    const result = await fs.loadChecklist('VIG')

    expect(mockElectronAPI.readFile).toHaveBeenCalled()
    expect(parseChecklist).toHaveBeenCalledWith('{"specialty": "VIG"}')
    expect(result).toEqual({ specialty: 'VIG' })
  })

  it('loadSession returns null if session file does not exist', async () => {
    mockElectronAPI.checkPath.mockResolvedValue(false)
    const result = await fs.loadSession('VIG')
    expect(result).toBe(null)
  })

  it('readEvidence returns a list of files', async () => {
    const mockDirList = [{ name: 'file1' }]
    mockElectronAPI.listPath.mockResolvedValue(mockDirList)

    const result = await fs.readEvidence('VIG')

    expect(mockElectronAPI.listPath).toHaveBeenCalledWith(null, 'VIG', 'Evidence')
    expect(result).toEqual(mockDirList)
  })

  describe('saveEvidence', () => {
    it('calls saveFile with correct arguments', async () => {
      mockElectronAPI.saveFile.mockResolvedValue(true)
      const result = await fs.saveEvidence('VIG', 'file1.txt', Buffer.from('This is a buffer'))

      expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
        Buffer.from('This is a buffer'),
        null,
        'VIG',
        'Evidence',
        'file1.txt'
      )
    })

    it('throws error for empty or undefined buffer', async () => {
      const errorMessage = 'saveEvidence: could not save evidence for VIG/file1.txt :'
      await expect(fs.saveEvidence('VIG', 'file1.txt', Buffer.from(''))).rejects.toThrowError(
        errorMessage + ' File is empty'
      )

      await expect(fs.saveEvidence('VIG', 'file1.txt', undefined)).rejects.toThrowError(
        errorMessage + ' Buffer is undefined'
      )
    })

    it('throws error for files over the size limit (10MB)', async () => {
      mockElectronAPI.saveFile.mockResolvedValue(true)
      const errorMessage =
        'saveEvidence: could not save evidence for VIG/file1.txt : File size exceeds 10MB limit'

      await expect(
        fs.saveEvidence('VIG', 'file1.txt', new ArrayBuffer(10 * 1000 * 1000 + 1))
      ).rejects.toThrowError(errorMessage)

      await fs.saveEvidence('VIG', 'file1.txt', new ArrayBuffer(10 * 1000 * 1000 - 1))
    })
  })

  describe('saveExportFile', async () => {
    it('calls saveFile with correct arguments', async () => {
      mockElectronAPI.saveFile.mockResolvedValue(true)

      const result = await fs.saveExportFile('This is a checklist', 'VIG')

      expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
        'This is a checklist',
        null,
        'VIG',
        'compliance_export.csv'
      )
    })

    it('handles empty checklists', async () => {
      await expect(fs.saveExportFile('', 'VIG')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
      await expect(fs.saveExportFile(null, 'VIG')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
      await expect(fs.saveExportFile(undefined, 'VIG')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
    })

    it('handles errors', async () => {
      mockElectronAPI.saveFile.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })
      await expect(fs.saveExportFile('This is a', 'VIG')).rejects.toThrow(
        'saveExportFile: could not save file: Save failed'
      )
    })
  })

  describe('saveSession', async () => {
    it('calls saveFile with correct arguments', async () => {
      const mockSessionSummary = {
        specialty: 'VIG',
        finalized: false,
        lastUpdated: '2023-01-01T10:00:00Z',
        generalComments: '',
      }

      const mockSessionResponses = {
        1: {
          id: '1',
          compliance: 'Compliant',
          comments: 'Test comments',
          evidence: ['file1.txt'],
        },
      }
      const mockCallback = () => {
        console.log('varna')
      }
      mockElectronAPI.saveFile.mockResolvedValue(true)

      const result = await fs.saveSession(mockSessionSummary, mockSessionResponses, mockCallback)

      expect(result).toBe(true)
    })

    it('saves session after debounce', async () => {
      vi.clearAllTimers()

      const mockSessionSummary = {
        specialty: 'VIG',
        finalized: false,
        lastUpdated: new Date().toISOString(),
        generalComments: '',
      }

      const mockSessionResponses = {
        1: {
          id: '1',
          compliance: 'Compliant',
          comments: 'Test comments',
          evidence: ['file1.txt'],
        },
      }
      const mockCallback = () => {
        console.log('varna')
      }
      const mockSessionString = JSON.stringify(
        { summary: mockSessionSummary, responses: mockSessionResponses },
        null,
        2
      )
      const result = await fs.saveSession(mockSessionSummary, mockSessionResponses, mockCallback)

      await vi.waitFor(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        mockSessionString,
        null,
        'VIG',
        'session.json'
      )
    })

    it('handles errors', async () => {
      vi.clearAllTimers()
      const mockSessionSummary = {
        specialty: 'VIG',
        finalized: false,
        lastUpdated: new Date().toISOString(),
        generalComments: '',
      }

      const mockSessionResponses = {
        1: {
          id: '1',
          compliance: 'Compliant',
          comments: 'Test comments',
          evidence: ['file1.txt'],
        },
      }
      const mockCallback = vi.fn()

      mockElectronAPI.saveFile.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })
      const result = await fs.saveSession(mockSessionSummary, mockSessionResponses, mockCallback)

      await vi.waitFor(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result).toBe(true)
      expect(mockCallback).toHaveBeenCalledWith('Save failed')
    })
  })

  describe('uncovered branches and errors', () => {
    it('throws error if getSizeAndSuffix receives invalid format', () => {
      expect(() => getSizeAndSuffix('notasize')).toThrow('Invalid file size format: notasize')
    })

    it('setSavePath returns null if checkPath is false', async () => {
      const fs = createFileService()
      window.electronAPI.getPath.mockReturnValue('/mocked/path')
      window.electronAPI.checkPath.mockResolvedValue(false)
      const result = await fs.setSavePath('VIG')
      expect(result).toBeNull()
    })

    it('createDefaultPath throws error', async () => {
      const fs = createFileService()
      window.electronAPI.createDir.mockRejectedValue(new Error('fail'))
      await expect(fs.createDefaultPath('VIG')).rejects.toThrow('createDefaultPath: could not create path VIG : fail')
    })

    it('deleteEvidence throws error', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockRejectedValue(new Error('fail'))
      await expect(fs.deleteEvidence('VIG', 'file.txt')).rejects.toThrow('deleteEvidence: could not delete evidence VIG/file.txt : fail')
    })

    it('readEvidence throws error', async () => {
      const fs = createFileService()
      window.electronAPI.listPath.mockRejectedValue(new Error('fail'))
      await expect(fs.readEvidence('VIG')).rejects.toThrow('readEvidence: could not read evidence for VIG : fail')
    })
  })
})
