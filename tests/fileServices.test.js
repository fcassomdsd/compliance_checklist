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

describe('fileServices', () => {
  const fs = createFileService()

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
    mockElectronAPI.checkPath.mockResolvedValue(true)
    mockElectronAPI.readFile.mockResolvedValue('{"specialty": "VIG"}')
    parseChecklist.mockResolvedValue({ specialty: 'VIG' })

    const result = await fs.loadChecklist('VIG')

    expect(mockElectronAPI.checkPath).toHaveBeenCalled()
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
        location: 'Location A',
        finalized: false,
        lastUpdated: '2023-01-01T10:00:00Z',
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
        location: 'Location A',
        finalized: false,
        lastUpdated: new Date().toISOString(),
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
        location: 'Location A',
        finalized: false,
        lastUpdated: new Date().toISOString(),
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
})
