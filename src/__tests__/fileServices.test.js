// fileServices.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFileService } from '../utils/fileServices'
import { parseChecklist } from '../utils/checklist'

vi.useFakeTimers()

// Mock the electronAPI and utils
const mockElectronAPI = {
  checkPath: vi.fn(),
  getPath: vi.fn(),
  getStats: vi.fn(),
  readFile: vi.fn(),
  listPath: vi.fn(),
  saveFile: vi.fn(),
  getFullPath: vi.fn(),
  generatePDF: vi.fn(),
  exportInspectionPayload: vi.fn(),
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
      // eslint-disable-next-line no-undef, no-unused-vars
      const result = await fs.saveEvidence('VIG', 'file1.txt', Buffer.from('This is a buffer'))

      expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
        // eslint-disable-next-line no-undef
        Buffer.from('This is a buffer'),
        null,
        'VIG',
        'Evidence',
        'file1.txt'
      )
    })

    it('throws error for empty or undefined buffer', async () => {
      const errorMessage = 'saveEvidence: could not save evidence for VIG/file1.txt :'
      // eslint-disable-next-line no-undef
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

      await fs.saveExportFile('This is a checklist', 'VIG')

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

  describe('saveFindingsReport', async () => {
    it('calls generatePDF with correct parameters', async () => {
      mockElectronAPI.getFullPath.mockResolvedValue(
        '/path/to/report_reporte_hallazgos_2024-01-15.pdf'
      )
      mockElectronAPI.generatePDF.mockResolvedValue(
        '/path/to/report_reporte_hallazgos_2024-01-15.pdf'
      )

      const checklist = { questions: [] }
      const session = { responses: {} }

      await fs.saveFindingsReport(checklist, session, 'VIG')

      expect(mockElectronAPI.getFullPath).toHaveBeenCalled()
      expect(mockElectronAPI.generatePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          checklistString: JSON.stringify(checklist),
          sessionString: JSON.stringify(session),
          specialty: 'VIG',
        })
      )
    })

    it('includes current date in filename', async () => {
      const expectedPath = '/path/to/reporte_hallazgos_2024-01-15.pdf'
      mockElectronAPI.getFullPath.mockResolvedValue(expectedPath)
      mockElectronAPI.generatePDF.mockResolvedValue(expectedPath)

      const checklist = { questions: [] }
      const session = { responses: {} }

      await fs.saveFindingsReport(checklist, session, 'VIG')

      const callArgs = mockElectronAPI.generatePDF.mock.calls[0][0]
      expect(callArgs.outputPath).toContain('reporte_hallazgos')
    })

    it('handles missing checklist', async () => {
      mockElectronAPI.getFullPath.mockResolvedValue('/path/to/report.pdf')

      await expect(fs.saveFindingsReport(null, { responses: {} }, 'VIG')).rejects.toThrow(
        'saveFindingsReport: could not generate PDF'
      )
    })

    it('handles missing session', async () => {
      mockElectronAPI.getFullPath.mockResolvedValue('/path/to/report.pdf')

      await expect(fs.saveFindingsReport({ questions: [] }, null, 'VIG')).rejects.toThrow(
        'saveFindingsReport: could not generate PDF'
      )
    })

    it('handles missing specialty', async () => {
      mockElectronAPI.getFullPath.mockResolvedValue('/path/to/report.pdf')

      await expect(
        fs.saveFindingsReport({ questions: [] }, { responses: {} }, null)
      ).rejects.toThrow('saveFindingsReport: could not generate PDF')
    })

    it('handles generatePDF errors', async () => {
      mockElectronAPI.getFullPath.mockResolvedValue('/path/to/report.pdf')
      mockElectronAPI.generatePDF.mockRejectedValue(new Error('PDF generation failed'))

      const checklist = { questions: [] }
      const session = { responses: {} }

      await expect(fs.saveFindingsReport(checklist, session, 'VIG')).rejects.toThrow(
        'saveFindingsReport: could not generate PDF'
      )
    })
  })

  describe('exportInspectionPayload', () => {
    it('calls electron exportInspectionPayload with stringified data', async () => {
      const checklist = { questions: [] }
      const session = { summary: { specialty: 'VIG' }, responses: {} }
      const expectedResult = { zipPath: '/tmp/payload.zip', uploadStatus: 200 }
      mockElectronAPI.exportInspectionPayload.mockResolvedValue(expectedResult)

      const result = await fs.exportInspectionPayload(checklist, session, 'VIG')

      expect(mockElectronAPI.exportInspectionPayload).toHaveBeenCalledWith({
        checklistString: JSON.stringify(checklist),
        sessionString: JSON.stringify(session),
        specialty: 'VIG',
      })
      expect(result).toEqual(expectedResult)
    })

    it('throws for missing parameters', async () => {
      await expect(fs.exportInspectionPayload(null, { responses: {} }, 'VIG')).rejects.toThrow(
        'exportInspectionPayload: could not export and upload payload'
      )
      await expect(
        fs.exportInspectionPayload({ questions: [] }, null, 'VIG')
      ).rejects.toThrow('exportInspectionPayload: could not export and upload payload')
      await expect(
        fs.exportInspectionPayload({ questions: [] }, { responses: {} }, '')
      ).rejects.toThrow('exportInspectionPayload: could not export and upload payload')
    })
  })

  describe('saveSession', async () => {

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
      await fs.saveSession(mockSessionSummary, mockSessionResponses, mockCallback)

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
      await expect(fs.createDefaultPath('VIG')).rejects.toThrow(
        'createDefaultPath: could not create path VIG : fail'
      )
    })

    it('deleteEvidence throws error', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockRejectedValue(new Error('fail'))
      await expect(fs.deleteEvidence('VIG', 'file.txt')).rejects.toThrow(
        'deleteEvidence: could not delete evidence VIG/file.txt : fail'
      )
    })

    it('readEvidence throws error', async () => {
      const fs = createFileService()
      window.electronAPI.listPath.mockRejectedValue(new Error('fail'))
      await expect(fs.readEvidence('VIG')).rejects.toThrow(
        'readEvidence: could not read evidence for VIG : fail'
      )
    })

    it('saveEvidence should not save if file exists with same size', async () => {
      const fs = createFileService()
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('This is a buffer')
      const fileSize = buffer.byteLength
      window.electronAPI.getStats.mockResolvedValue({ size: fileSize })
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path')

      const result = await fs.saveEvidence('VIG', 'file1.txt', buffer)

      expect(result).toBeNull()
      expect(window.electronAPI.saveFile).not.toHaveBeenCalled()
    })

    it('loadChecklist creates dummy checklist when path does not exist', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValueOnce(false)
      window.electronAPI.readFile.mockResolvedValue('{"specialtyName":"Test"}')

      await fs.loadChecklist('VIG')

      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null, 'VIG', 'Evidence')
      expect(window.electronAPI.saveFile).toHaveBeenCalled()
    })

    it('loadChecklist throws error when checkPath fails', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockRejectedValue(new Error('path check failed'))

      await expect(fs.loadChecklist('VIG')).rejects.toThrow(
        'loadChecklist: could not load checklist for VIG : path check failed'
      )
    })

    it('loadSession returns parsed session when file exists', async () => {
      const fs = createFileService()
      const mockSession = { summary: { specialty: 'VIG' }, responses: {} }
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(mockSession))

      await fs.loadSession('VIG')

      expect(window.electronAPI.checkPath).toHaveBeenCalledWith(null, 'VIG', 'session.json')
    })

    it('loadSession throws error on failure', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockRejectedValue(new Error('check failed'))

      await expect(fs.loadSession('VIG')).rejects.toThrow(
        'loadSession: could not load session for VIG : check failed'
      )
    })

    it('saveAudio saves audio file successfully', async () => {
      const fs = createFileService()
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('audio data')
      window.electronAPI.saveFile.mockResolvedValue('/mocked/audio.webm')

      const result = await fs.saveAudio('VIG', 'audio.webm', buffer)

      expect(result).toBe('/mocked/audio.webm')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        buffer,
        null,
        'VIG',
        'Audio',
        'audio.webm'
      )
    })

    it('saveAudio throws error for empty buffer', async () => {
      const fs = createFileService()
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('')

      await expect(fs.saveAudio('VIG', 'audio.webm', buffer)).rejects.toThrow(
        'saveAudio: could not save audio for VIG/audio.webm : Audio file is empty'
      )
    })

    it('saveAudio throws error for undefined buffer', async () => {
      const fs = createFileService()

      await expect(fs.saveAudio('VIG', 'audio.webm', undefined)).rejects.toThrow(
        'saveAudio: could not save audio for VIG/audio.webm : Buffer is undefined'
      )
    })

    it('deleteAudio throws error', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockRejectedValue(new Error('delete failed'))

      await expect(fs.deleteAudio('VIG', 'audio.webm')).rejects.toThrow(
        'deleteAudio: could not delete audio VIG/audio.webm : delete failed'
      )
    })

    it('readAudio returns list of audio files', async () => {
      const fs = createFileService()
      const mockAudioList = ['audio1.webm', 'audio2.webm']
      window.electronAPI.listPath.mockResolvedValue(mockAudioList)

      const result = await fs.readAudio('VIG')

      expect(result).toEqual(mockAudioList)
      expect(window.electronAPI.listPath).toHaveBeenCalledWith(null, 'VIG', 'Audio')
    })

    it('readAudio throws error', async () => {
      const fs = createFileService()
      window.electronAPI.listPath.mockRejectedValue(new Error('list failed'))

      await expect(fs.readAudio('VIG')).rejects.toThrow(
        'readAudio: could not read audio for VIG : list failed'
      )
    })

    it('createDefaultRoot creates directory structure', async () => {
      const fs = createFileService()
      window.electronAPI.createDir.mockResolvedValue(undefined)
      window.electronAPI.saveFile.mockResolvedValue(undefined)

      const result = await fs.createDefaultRoot()

      expect(result).toEqual({ success: true, message: 'Default root created successfully' })
      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null)
      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null, 'DEMO', 'Evidence')
      expect(window.electronAPI.saveFile).toHaveBeenCalledTimes(2)
    })

    it('saveExportFile throws error for empty content', async () => {
      const fs = createFileService()

      await expect(fs.saveExportFile('', 'VIG')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
    })

    it('saveExportFile saves CSV file successfully', async () => {
      const fs = createFileService()
      const csvContent = 'ref,question,comment\nREF001,Question 1,OK'
      window.electronAPI.saveFile.mockResolvedValue(undefined)

      await fs.saveExportFile(csvContent, 'VIG')

      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(csvContent, null, 'VIG', 'compliance_export.csv')
    })

    it('loadSpecialties returns list of specialties', async () => {
      const fs = createFileService()
      const mockConfig = {
        specialties: [
          { code: 'VIG', name: 'Vigilancia' },
          { code: 'OPS', name: 'Operaciones' },
        ],
      }
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(mockConfig))

      const result = await fs.loadSpecialties()

      expect(result).toEqual(mockConfig.specialties)
    })

    it('loadSpecialties throws error on read failure', async () => {
      const fs = createFileService()
      window.electronAPI.readFile.mockRejectedValue(new Error('read failed'))

      await expect(fs.loadSpecialties()).rejects.toThrow(
        'loadSpecialties: could not load specialties : read failed'
      )
    })

    it('setSavePath returns path if checkPath is true', async () => {
      const fs = createFileService()
      window.electronAPI.getPath.mockReturnValue('/mocked/path')
      window.electronAPI.checkPath.mockResolvedValue(true)

      const result = await fs.setSavePath('VIG')

      expect(result).toBe('/mocked/path')
    })

    it('setSavePath throws error on checkPath failure', async () => {
      const fs = createFileService()
      window.electronAPI.getPath.mockReturnValue('/mocked/path')
      window.electronAPI.checkPath.mockRejectedValue(new Error('check failed'))

      await expect(fs.setSavePath('VIG')).rejects.toThrow(
        'setSavePath: could not save path VIG : check failed'
      )
    })

    it('defaultPathExists throws error', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockRejectedValue(new Error('check failed'))

      await expect(fs.defaultPathExists()).rejects.toThrow(
        'defaultPathExists: could not check default path: check failed'
      )
    })

    it('saveExportFile throws error on write failure', async () => {
      const fs = createFileService()
      const csvContent = 'ref,question,comment\nREF001,Question 1,OK'
      window.electronAPI.saveFile.mockRejectedValue(new Error('write failed'))

      await expect(fs.saveExportFile(csvContent, 'VIG')).rejects.toThrow(
        'saveExportFile: could not save file: write failed'
      )
    })

    it('getSizeAndSuffix handles bytes correctly', () => {
      const result = getSizeAndSuffix('100B')
      expect(result.size).toBe(100)
      expect(result.label).toBe('100B')
    })

    it('getSizeAndSuffix handles KiB correctly', () => {
      const result = getSizeAndSuffix('2KIB')
      expect(result.size).toBe(2048)
      expect(result.label).toBe('2KiB')
    })

    it('getSizeAndSuffix handles MiB correctly', () => {
      const result = getSizeAndSuffix('1MIB')
      expect(result.size).toBe(1048576)
      expect(result.label).toBe('1MiB')
    })

    it('getSizeAndSuffix handles GiB correctly', () => {
      const result = getSizeAndSuffix('1GIB')
      expect(result.size).toBe(1073741824)
      expect(result.label).toBe('1GiB')
    })

    it('deleteEvidence should return deletion result', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockResolvedValue(true)

      const result = await fs.deleteEvidence('VIG', 'file.txt')

      expect(result).toBe(true)
      expect(window.electronAPI.deleteFile).toHaveBeenCalledWith(null, 'VIG', 'Evidence', 'file.txt')
    })

    it('deleteAudio should return deletion result', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockResolvedValue(true)

      const result = await fs.deleteAudio('VIG', 'audio.webm')

      expect(result).toBe(true)
      expect(window.electronAPI.deleteFile).toHaveBeenCalledWith(null, 'VIG', 'Audio', 'audio.webm')
    })

    it('getSizeAndSuffix handles decimal sizes correctly', () => {
      const result = getSizeAndSuffix('1.5MB')
      expect(result.size).toBe(1500000)
      expect(result.label).toBe('1.5MB')
    })

    it('getSizeAndSuffix handles KB correctly', () => {
      const result = getSizeAndSuffix('100KB')
      expect(result.size).toBe(100000)
      expect(result.label).toBe('100kB')
    })
  })

  describe('import checklist features', () => {
    it('getChecklistImportState returns state when checklist and session exist', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath
        .mockResolvedValueOnce(true) // checklist exists
        .mockResolvedValueOnce(true) // session exists
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify({
        summary: { specialty: 'VIG', finalized: false },
        responses: {}
      }))

      const result = await fs.getChecklistImportState('VIG')

      expect(result).toEqual({
        hasChecklist: true,
        hasSession: true,
        sessionFinalized: false
      })
    })

    it('getChecklistImportState returns state when checklist exists but no session', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath
        .mockResolvedValueOnce(true) // checklist exists
        .mockResolvedValueOnce(false) // session does not exist

      const result = await fs.getChecklistImportState('VIG')

      expect(result).toEqual({
        hasChecklist: true,
        hasSession: false,
        sessionFinalized: null
      })
    })

    it('getChecklistImportState returns state when nothing exists', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath
        .mockResolvedValueOnce(false) // checklist does not exist
        .mockResolvedValueOnce(false) // session does not exist

      const result = await fs.getChecklistImportState('VIG')

      expect(result).toEqual({
        hasChecklist: false,
        hasSession: false,
        sessionFinalized: null
      })
    })

    it('getChecklistImportState throws error for invalid specialty', async () => {
      const fs = createFileService()

      await expect(fs.getChecklistImportState('')).rejects.toThrow(
        'getChecklistImportState: could not check import state for  : Invalid specialty value:'
      )
    })

    it('fetchChecklistFromApi fetches and validates checklist from API', async () => {
      const fs = createFileService()
      const mockChecklist = {
        specialtyName: 'Test Specialty',
        inspection: '0224',
        location: 'Test Location',
        startDate: '2024-01-01',
        questions: [
          {
            id: 'q1',
            topic: 'Topic 1',
            reference: 'REF001',
            question: 'Test question?',
            verification: 'Test verification'
          }
        ]
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockChecklist)
      }))

      parseChecklist.mockReturnValue(mockChecklist)

      const result = await fs.fetchChecklistFromApi('0224', 'VIG')

      expect(fetch).toHaveBeenCalledWith('http://localhost:1880/checklist?inspection=0224&specialty=VIG')
      expect(result).toEqual(mockChecklist)
    })

    it('fetchChecklistFromApi throws error for missing parameters', async () => {
      const fs = createFileService()

      await expect(fs.fetchChecklistFromApi('', 'VIG')).rejects.toThrow(
        'fetchChecklistFromApi: could not fetch checklist: Missing required parameters'
      )

      await expect(fs.fetchChecklistFromApi('0224', '')).rejects.toThrow(
        'fetchChecklistFromApi: could not fetch checklist: Missing required parameters'
      )
    })

    it('fetchChecklistFromApi throws error for non-OK response', async () => {
      const fs = createFileService()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      }))

      await expect(fs.fetchChecklistFromApi('0224', 'VIG')).rejects.toThrow(
        'fetchChecklistFromApi: could not fetch checklist: Import failed with status 404'
      )
    })

    it('ensureSpecialtyEntry adds new specialty to config', async () => {
      const fs = createFileService()
      const existingConfig = {
        specialties: [
          { code: 'VIG', name: 'Vigilancia' }
        ]
      }

      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(existingConfig))
      window.electronAPI.saveFile.mockResolvedValue(undefined)

      await fs.ensureSpecialtyEntry('OPS', 'Operaciones')

      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('"code": "OPS"'),
        null,
        'user.config.json'
      )
    })

    it('ensureSpecialtyEntry does not duplicate existing specialty', async () => {
      const fs = createFileService()
      const existingConfig = {
        specialties: [
          { code: 'VIG', name: 'Vigilancia' }
        ]
      }

      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(existingConfig))
      window.electronAPI.saveFile.mockResolvedValue(undefined)

      await fs.ensureSpecialtyEntry('VIG', 'Vigilancia')

      expect(window.electronAPI.saveFile).not.toHaveBeenCalled()
    })

    it('ensureSpecialtyEntry creates config if it does not exist', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(false)
      window.electronAPI.saveFile.mockResolvedValue(undefined)

      await fs.ensureSpecialtyEntry('OPS', 'Operaciones')

      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('"code": "OPS"'),
        null,
        'user.config.json'
      )
    })

    it('ensureSpecialtyEntry throws error for missing specialty code', async () => {
      const fs = createFileService()

      await expect(fs.ensureSpecialtyEntry('', 'Name')).rejects.toThrow(
        'ensureSpecialtyEntry: could not update specialties: Missing specialty code'
      )
    })

    it('saveChecklist saves checklist to file', async () => {
      const fs = createFileService()
      const mockChecklist = {
        specialtyName: 'Test',
        questions: []
      }

      window.electronAPI.createDir.mockResolvedValue(undefined)
      window.electronAPI.saveFile.mockResolvedValue(undefined)

      await fs.saveChecklist('VIG', mockChecklist)

      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null, 'VIG', 'Evidence')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        JSON.stringify(mockChecklist, null, 2),
        null,
        'VIG',
        'checklist.json'
      )
    })

    it('saveChecklist throws error for missing parameters', async () => {
      const fs = createFileService()

      await expect(fs.saveChecklist('', {})).rejects.toThrow(
        'saveChecklist: could not save checklist: Missing required parameters'
      )

      await expect(fs.saveChecklist('VIG', null)).rejects.toThrow(
        'saveChecklist: could not save checklist: Missing required parameters'
      )
    })
  })
})
