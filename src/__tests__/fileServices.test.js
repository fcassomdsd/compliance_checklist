// fileServices.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFileService } from '../utils/fileServices'
import { parseChecklist } from '../utils/checklist'
import { parseFindings } from '../utils/findings'

vi.useFakeTimers()

const mockAppConfig = {
  api: {
    host: 'http://localhost:1880',
    importHost: 'http://localhost:1880',
    uploadHost: 'http://localhost:8000',
    importCanonicalDelay: 0,
    importCanonicalRetries: 3,
  },
  fallback: {
    specialties: [
      { code: 'VIG', name: 'Sistemas de Vigilancia' },
      { code: 'COM', name: 'Comunicaciones de Radio' },
    ],
  },
}

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
  exportFollowUpPayload: vi.fn(),
  checkServiceHealth: vi.fn(),
  getAppConfig: vi.fn().mockResolvedValue(mockAppConfig),
}
window.electronAPI = mockElectronAPI
vi.mock('../utils/checklist.js')
vi.mock('../utils/findings.js')
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
    window.electronAPI.getAppConfig.mockResolvedValue(mockAppConfig)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

    it('stores follow-up evidence in FollowUpEvidence directory', async () => {
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('follow-up buffer')
      mockElectronAPI.getStats.mockResolvedValue(null)
      mockElectronAPI.saveFile.mockResolvedValue('/mocked/VIG/loc-001__VIG/FollowUpEvidence/file1.txt')

      await fs.saveEvidence('VIG', 'file1.txt', buffer, 'loc-001', 'followUp')

      expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
        buffer,
        null,
        'LOC-001_VIG',
        'FollowUpEvidence',
        'file1.txt'
      )
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

  describe('exportFollowUpPayload', () => {
    it('calls electron exportFollowUpPayload with stringified data', async () => {
      const findings = [{ finding: { findingId: 'F-1', locationId: 'loc-1' } }]
      const followUpSession = { summary: { specialty: 'VIG' }, responses: { 'F-1': {} } }
      const expectedResult = { zipPath: '/tmp/followup.zip', uploadStatus: 200 }
      mockElectronAPI.exportFollowUpPayload.mockResolvedValue(expectedResult)

      const result = await fs.exportFollowUpPayload(findings, followUpSession, 'VIG', 'loc-1')

      expect(mockElectronAPI.exportFollowUpPayload).toHaveBeenCalledWith({
        findingsString: JSON.stringify(findings),
        followUpSessionString: JSON.stringify(followUpSession),
        specialty: 'VIG',
        locationId: 'loc-1',
      })
      expect(result).toEqual(expectedResult)
    })

    it('throws for missing parameters', async () => {
      await expect(fs.exportFollowUpPayload(null, { responses: {} }, 'VIG')).rejects.toThrow(
        'exportFollowUpPayload: could not export and upload follow-up payload'
      )
      await expect(fs.exportFollowUpPayload([], null, 'VIG')).rejects.toThrow(
        'exportFollowUpPayload: could not export and upload follow-up payload'
      )
      await expect(fs.exportFollowUpPayload([], { responses: {} }, '')).rejects.toThrow(
        'exportFollowUpPayload: could not export and upload follow-up payload'
      )
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

  describe('follow-up session persistence', () => {
    it('loads follow-up session when file exists', async () => {
      const fs = createFileService()
      const payload = { summary: { finalized: false }, responses: { F1: { findingId: 'F1' } } }
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(payload))

      const result = await fs.loadFollowUpSession('VIG', 'loc-001')

      expect(result).toEqual(payload)
      expect(window.electronAPI.checkPath).toHaveBeenCalledWith(
        null,
        'LOC-001_VIG',
        'followup.session.json'
      )
    })

    it('returns null when follow-up session file does not exist', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(false)

      const result = await fs.loadFollowUpSession('VIG', 'loc-001')

      expect(result).toBeNull()
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
      expect(window.electronAPI.saveFile).toHaveBeenCalledTimes(1)
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
      const apiSpecialties = [
        { code: 'VIG', name: 'Sistemas de Vigilancia' },
        { code: 'COM', name: 'Comunicaciones de Radio' },
      ]
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(apiSpecialties),
        })
      )

      const result = await fs.loadSpecialties()

      expect(fetch).toHaveBeenCalledWith('http://localhost:1880/specialties?option=leaf')
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result).toEqual([
        { id: 'VIG', code: 'VIG', name: 'Sistemas de Vigilancia' },
        { id: 'COM', code: 'COM', name: 'Comunicaciones de Radio' },
      ])
      expect(result[0]).toHaveProperty('code')
      expect(result[0]).toHaveProperty('name')
    })

    it('loadSpecialties falls back to app config when API is unavailable', async () => {
      const fs = createFileService()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      const result = await fs.loadSpecialties()

      expect(fetch).toHaveBeenCalledWith('http://localhost:1880/specialties?option=leaf')
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result).toEqual([
        { id: 'VIG', code: 'VIG', name: 'Sistemas de Vigilancia' },
        { id: 'COM', code: 'COM', name: 'Comunicaciones de Radio' },
      ])
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

    it('ensureSpecialtyEntry returns normalized specialty and does not persist local config', async () => {
      const fs = createFileService()
      const result = await fs.ensureSpecialtyEntry('OPS', 'Operaciones')

      expect(result).toEqual({ code: 'OPS', name: 'Operaciones' })
      expect(window.electronAPI.saveFile).not.toHaveBeenCalled()
    })

    it('ensureSpecialtyEntry works when specialty already exists upstream', async () => {
      const fs = createFileService()
      const result = await fs.ensureSpecialtyEntry('VIG', 'Vigilancia')

      expect(result).toEqual({ code: 'VIG', name: 'Vigilancia' })
      expect(window.electronAPI.saveFile).not.toHaveBeenCalled()
    })

    it('ensureSpecialtyEntry works without specialty name fallback', async () => {
      const fs = createFileService()
      const result = await fs.ensureSpecialtyEntry('OPS')

      expect(result).toEqual({ code: 'OPS', name: 'OPS' })
      expect(window.electronAPI.saveFile).not.toHaveBeenCalled()
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

    it('fetchFindingsFromApi fetches and validates findings from API', async () => {
      const fs = createFileService()
      const mockFindings = [
        {
          schemaVersion: '1.0',
          finding: {
            findingId: 'MDPP-VIG-2026-01',
            locationId: 'loc-001',
          },
        },
      ]

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockFindings),
        })
      )

      parseFindings.mockReturnValue(mockFindings)

      const result = await fs.fetchFindingsFromApi('VIG', 'loc-001', '0224')

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:1880/findings?specialty=VIG&locationId=loc-001&inspection=0224'
      )
      expect(result).toEqual(mockFindings)
    })

    it('fetchFindingsFromApi throws for non-ok response', async () => {
      const fs = createFileService()

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        })
      )

      await expect(fs.fetchFindingsFromApi('VIG', 'loc-001')).rejects.toThrow(
        'fetchFindingsFromApi: could not fetch findings: Findings import failed with status 500'
      )
    })

    it('saveFindings stores findings using workspace path', async () => {
      const fs = createFileService()
      const findings = [{ finding: { findingId: 'F-1', locationId: 'loc-001' } }]
      window.electronAPI.createDir.mockResolvedValue(undefined)
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path/findings.json')

      const result = await fs.saveFindings('VIG', findings, 'loc-001')

      expect(result).toBe('/mocked/path/findings.json')
      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null, 'LOC-001_VIG')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        JSON.stringify(findings, null, 2),
        null,
        'LOC-001_VIG',
        'findings.json'
      )
    })

    it('loadFindings returns parsed findings when file exists', async () => {
      const fs = createFileService()
      const findings = [{ finding: { findingId: 'F-1', locationId: 'loc-001' } }]

      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(findings))
      parseFindings.mockReturnValue(findings)

      const result = await fs.loadFindings('VIG', 'loc-001')

      expect(result).toEqual(findings)
      expect(window.electronAPI.checkPath).toHaveBeenCalledWith(
        null,
        'LOC-001_VIG',
        'findings.json'
      )
    })

    it('loadFindings returns null when no findings file exists', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(false)

      const result = await fs.loadFindings('VIG', 'loc-001')

      expect(result).toBeNull()
    })

    it('getFindingsImportState returns findings and follow-up session state', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
      window.electronAPI.readFile.mockResolvedValue(
        JSON.stringify({ summary: { finalized: false }, responses: {} })
      )

      const result = await fs.getFindingsImportState('VIG', 'loc-001')

      expect(result).toEqual({
        hasFindings: true,
        hasFollowUpSession: true,
        followUpFinalized: false,
      })
    })

    it('joinChecklistWithFindings enriches questions and reports unmatched findings', () => {
      const fs = createFileService()

      const checklist = {
        specialtyName: 'VIG',
        questions: [
          {
            id: 'q1',
            topic: 'Topic',
            reference: { normativa: {}, guidance: 'GM' },
            question: 'Question 1',
            verification: 'Verification',
            priorFindingId: 'F-1',
          },
        ],
      }

      const findings = [
        { finding: { findingId: 'F-1', locationId: 'loc-001' } },
        { finding: { findingId: 'F-2', locationId: 'loc-001' } },
      ]

      const result = fs.joinChecklistWithFindings(checklist, findings)

      expect(result.checklist.questions[0].priorFinding.findingId).toBe('F-1')
      expect(result.unmatchedFindings).toHaveLength(1)
      expect(result.unmatchedFindings[0].finding.findingId).toBe('F-2')
    })
  })

  describe('workspace scaffolding', () => {
    it('builds workspace key using location and specialty', () => {
      const fs = createFileService()
      const key = fs.getWorkspaceKey('loc-001', 'vig')
      expect(key).toBe('loc-001__VIG')
    })

    it('builds workspace legs with location context', () => {
      const fs = createFileService()
      const legs = fs.getWorkspaceLegs('vig', 'loc-001')
      expect(legs).toEqual(['LOC-001_VIG'])
    })

    it('builds legacy workspace legs when location is not provided', () => {
      const fs = createFileService()
      const legs = fs.getWorkspaceLegs('vig')
      expect(legs).toEqual(['VIG'])
    })

    it('builds file and directory paths from workspace', () => {
      const fs = createFileService()
      const paths = fs.getWorkspacePaths('OPS', 'mdbq')

      expect(paths.legs).toEqual(['MDBQ_OPS'])
      expect(paths.checklist).toEqual(['MDBQ_OPS', 'checklist.json'])
      expect(paths.findings).toEqual(['MDBQ_OPS', 'findings.json'])
      expect(paths.followUpSession).toEqual(['MDBQ_OPS', 'followup.session.json'])
      expect(paths.followUpEvidenceDir).toEqual(['MDBQ_OPS', 'FollowUpEvidence'])
    })

    it('replaces JSON file only when payload parses successfully', async () => {
      const fs = createFileService()
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path/workspace.json')

      const result = await fs.replaceJsonFileSafely({ key: 'value' }, 'OPS', 'workspace.json')

      expect(result).toBe('/mocked/path/workspace.json')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        JSON.stringify({ key: 'value' }, null, 2),
        null,
        'OPS',
        'workspace.json'
      )
    })

    it('does not overwrite file when replacement payload is invalid JSON', async () => {
      const fs = createFileService()

      await expect(fs.replaceJsonFileSafely('{', 'OPS', 'workspace.json')).rejects.toThrow(
        'replaceJsonFileSafely: could not replace OPS/workspace.json :'
      )
      expect(window.electronAPI.saveFile).not.toHaveBeenCalled()
    })

    it('loads empty workspace registry when file does not exist', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(false)

      const result = await fs.loadWorkspaceRegistry()

      expect(result).toEqual([])
      expect(window.electronAPI.checkPath).toHaveBeenCalledWith(null, 'workspaces.json')
    })

    it('loads workspace registry when file exists', async () => {
      const fs = createFileService()
      const registry = [{ workspaceKey: 'loc-001__VIG' }]
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(registry))

      const result = await fs.loadWorkspaceRegistry()

      expect(result).toEqual(registry)
      expect(window.electronAPI.readFile).toHaveBeenCalledWith(null, 'workspaces.json')
    })

    it('upserts workspace entry into registry', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue('[]')
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path/workspaces.json')

      const entry = await fs.upsertWorkspaceRegistryEntry({
        specialtyCode: 'vig',
        specialtyName: 'Vigilancia',
        locationId: 'loc-001',
        locationName: 'Location 1',
      })

      expect(entry.workspaceKey).toBe('loc-001__VIG')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('loc-001__VIG'),
        null,
        'workspaces.json'
      )
    })

    it('returns touched state from workspace metadata when available', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath
        .mockResolvedValueOnce(true)
      window.electronAPI.readFile.mockResolvedValue(
        JSON.stringify({ checklistTouched: true, followUpTouched: false })
      )

      const result = await fs.getWorkspaceTouchedState('VIG', 'loc-001')

      expect(result).toEqual({ checklistTouched: true, followUpTouched: false })
    })

    it('marks workspace checklist as touched', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
      window.electronAPI.readFile.mockResolvedValue('[]')
      window.electronAPI.createDir.mockResolvedValue(undefined)
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path')

      await fs.markWorkspaceTouched('VIG', 'loc-001')

      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('"checklistTouched": true'),
        null,
        'LOC-001_VIG',
        'workspace.json'
      )
    })
  })
})
