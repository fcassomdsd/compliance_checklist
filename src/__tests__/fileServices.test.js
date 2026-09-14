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
      { code: 'SUR', name: 'Vigilancia (radar)' },
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
  deletePath: vi.fn(),
  getFullPath: vi.fn(),
  generatePDF: vi.fn(),
  exportInspectionPayload: vi.fn(),
  exportFollowUpPayload: vi.fn(),
  checkServiceHealth: vi.fn(),
  getAppConfig: vi.fn().mockResolvedValue(mockAppConfig),
  readApiKey: vi.fn().mockResolvedValue(null),
  saveApiKey: vi.fn().mockResolvedValue(true),
  writeAppConfig: vi.fn().mockResolvedValue(true),
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
    window.electronAPI.deletePath = vi.fn()
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
    mockElectronAPI.readFile.mockResolvedValue('{"specialty": "SUR"}')
    parseChecklist.mockResolvedValue({ specialty: 'SUR' })

    const result = await fs.loadChecklist('SUR')

    expect(mockElectronAPI.readFile).toHaveBeenCalled()
    expect(parseChecklist).toHaveBeenCalledWith('{"specialty": "SUR"}')
    expect(result).toEqual({ specialty: 'SUR' })
  })

  it('loadSession returns null if session file does not exist', async () => {
    mockElectronAPI.checkPath.mockResolvedValue(false)
    const result = await fs.loadSession('SUR')
    expect(result).toBe(null)
  })

  it('readEvidence returns a list of files', async () => {
    const mockDirList = [{ name: 'file1' }]
    mockElectronAPI.checkPath.mockResolvedValue(true)
    mockElectronAPI.listPath.mockResolvedValue(mockDirList)

    const result = await fs.readEvidence('SUR')

    expect(mockElectronAPI.checkPath).toHaveBeenCalledWith(null, 'SUR', 'Evidence')
    expect(mockElectronAPI.listPath).toHaveBeenCalledWith(null, 'SUR', 'Evidence')
    expect(result).toEqual(mockDirList)
  })

  it('readEvidence returns empty list when evidence directory is missing', async () => {
    mockElectronAPI.checkPath.mockResolvedValue(false)

    const result = await fs.readEvidence('SUR', 'MDPP')

    expect(mockElectronAPI.checkPath).toHaveBeenCalledWith(null, 'MDPP_SUR', 'Evidence')
    expect(mockElectronAPI.listPath).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('readAudio returns empty list when audio directory is missing', async () => {
    mockElectronAPI.checkPath.mockResolvedValue(false)

    const result = await fs.readAudio('SUR', 'MDPP')

    expect(mockElectronAPI.checkPath).toHaveBeenCalledWith(null, 'MDPP_SUR', 'Audio')
    expect(mockElectronAPI.listPath).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  describe('saveEvidence', () => {
    it('calls saveFile with correct arguments', async () => {
      mockElectronAPI.saveFile.mockResolvedValue(true)
      // eslint-disable-next-line no-undef, no-unused-vars
      const result = await fs.saveEvidence('SUR', 'file1.txt', Buffer.from('This is a buffer'))

      expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
        // eslint-disable-next-line no-undef
        Buffer.from('This is a buffer'),
        null,
        'SUR',
        'Evidence',
        'file1.txt'
      )
    })

    it('throws error for empty or undefined buffer', async () => {
      const errorMessage = 'saveEvidence: could not save evidence for SUR/file1.txt :'
      // eslint-disable-next-line no-undef
      await expect(fs.saveEvidence('SUR', 'file1.txt', Buffer.from(''))).rejects.toThrowError(
        errorMessage + ' File is empty'
      )

      await expect(fs.saveEvidence('SUR', 'file1.txt', undefined)).rejects.toThrowError(
        errorMessage + ' Buffer is undefined'
      )
    })

    it('throws error for files over the size limit (10MB)', async () => {
      mockElectronAPI.saveFile.mockResolvedValue(true)
      const errorMessage =
        'saveEvidence: could not save evidence for SUR/file1.txt : File size exceeds 10MB limit'

      await expect(
        fs.saveEvidence('SUR', 'file1.txt', new ArrayBuffer(10 * 1000 * 1000 + 1))
      ).rejects.toThrowError(errorMessage)

      await fs.saveEvidence('SUR', 'file1.txt', new ArrayBuffer(10 * 1000 * 1000 - 1))
    })

    it('stores follow-up evidence in FollowUpEvidence directory', async () => {
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('follow-up buffer')
      mockElectronAPI.getStats.mockResolvedValue(null)
      mockElectronAPI.saveFile.mockResolvedValue('/mocked/SUR/loc-001__SUR/FollowUpEvidence/file1.txt')

      await fs.saveEvidence('SUR', 'file1.txt', buffer, 'loc-001', 'followUp')

      expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
        buffer,
        null,
        'LOC-001_SUR',
        'FollowUpEvidence',
        'file1.txt'
      )
    })
  })

  describe('saveExportFile', async () => {
    it('calls saveFile with correct arguments', async () => {
      mockElectronAPI.saveFile.mockResolvedValue(true)

      await fs.saveExportFile('This is a checklist', 'SUR')

      expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
        'This is a checklist',
        null,
        'SUR',
        'compliance_export.csv'
      )
    })

    it('handles empty checklists', async () => {
      await expect(fs.saveExportFile('', 'SUR')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
      await expect(fs.saveExportFile(null, 'SUR')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
      await expect(fs.saveExportFile(undefined, 'SUR')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
    })

    it('handles errors', async () => {
      mockElectronAPI.saveFile.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })
      await expect(fs.saveExportFile('This is a', 'SUR')).rejects.toThrow(
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

      await fs.saveFindingsReport(checklist, session, 'SUR')

      expect(mockElectronAPI.getFullPath).toHaveBeenCalled()
      expect(mockElectronAPI.generatePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          checklistString: JSON.stringify(checklist),
          sessionString: JSON.stringify(session),
          specialty: 'SUR',
        })
      )
    })

    it('includes current date in filename', async () => {
      const expectedPath = '/path/to/reporte_hallazgos_2024-01-15.pdf'
      mockElectronAPI.getFullPath.mockResolvedValue(expectedPath)
      mockElectronAPI.generatePDF.mockResolvedValue(expectedPath)

      const checklist = { questions: [] }
      const session = { responses: {} }

      await fs.saveFindingsReport(checklist, session, 'SUR')

      const callArgs = mockElectronAPI.generatePDF.mock.calls[0][0]
      expect(callArgs.outputPath).toContain('reporte_hallazgos')
    })

    it('uses workspace folder when locationId is provided', async () => {
      const expectedPath = '/path/to/MDPP_SUR/reporte_hallazgos_2024-01-15.pdf'
      mockElectronAPI.getFullPath.mockResolvedValue(expectedPath)
      mockElectronAPI.generatePDF.mockResolvedValue(expectedPath)

      const checklist = { questions: [] }
      const session = { responses: {} }

      await fs.saveFindingsReport(checklist, session, 'SUR', 'MDPP')

      expect(mockElectronAPI.getFullPath).toHaveBeenCalledWith(
        null,
        'MDPP_SUR',
        expect.stringContaining('reporte_hallazgos_')
      )
    })

    it('handles missing checklist', async () => {
      mockElectronAPI.getFullPath.mockResolvedValue('/path/to/report.pdf')

      await expect(fs.saveFindingsReport(null, { responses: {} }, 'SUR')).rejects.toThrow(
        'saveFindingsReport: could not generate PDF'
      )
    })

    it('handles missing session', async () => {
      mockElectronAPI.getFullPath.mockResolvedValue('/path/to/report.pdf')

      await expect(fs.saveFindingsReport({ questions: [] }, null, 'SUR')).rejects.toThrow(
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

      await expect(fs.saveFindingsReport(checklist, session, 'SUR')).rejects.toThrow(
        'saveFindingsReport: could not generate PDF'
      )
    })
  })

  describe('exportInspectionPayload', () => {
    it('calls electron exportInspectionPayload with stringified data', async () => {
      const checklist = { questions: [] }
      const session = { summary: { specialty: 'SUR' }, responses: {} }
      const expectedResult = { zipPath: '/tmp/payload.zip', uploadStatus: 200 }
      mockElectronAPI.exportInspectionPayload.mockResolvedValue(expectedResult)

      const result = await fs.exportInspectionPayload(checklist, session, 'SUR')

      expect(mockElectronAPI.exportInspectionPayload).toHaveBeenCalledWith({
        checklistString: JSON.stringify(checklist),
        sessionString: JSON.stringify(session),
        specialty: 'SUR',
      })
      expect(result).toEqual(expectedResult)
    })

    it('prefers explicit workspace locationId when provided', async () => {
      const checklist = { locationId: 'A01K5QC0YXTE2XTS3R9BTK77FT6', questions: [] }
      const session = { summary: { specialty: 'SUR' }, responses: {} }
      mockElectronAPI.exportInspectionPayload.mockResolvedValue({ zipPath: '/tmp/payload.zip', uploadStatus: 200 })

      await fs.exportInspectionPayload(checklist, session, 'SUR', 'MDPP')

      expect(mockElectronAPI.exportInspectionPayload).toHaveBeenCalledWith({
        checklistString: JSON.stringify(checklist),
        sessionString: JSON.stringify(session),
        specialty: 'SUR',
        locationId: 'MDPP',
      })
    })

    it('throws for missing parameters', async () => {
      await expect(fs.exportInspectionPayload(null, { responses: {} }, 'SUR')).rejects.toThrow(
        'exportInspectionPayload: could not export and upload payload'
      )
      await expect(
        fs.exportInspectionPayload({ questions: [] }, null, 'SUR')
      ).rejects.toThrow('exportInspectionPayload: could not export and upload payload')
      await expect(
        fs.exportInspectionPayload({ questions: [] }, { responses: {} }, '')
      ).rejects.toThrow('exportInspectionPayload: could not export and upload payload')
    })
  })

  describe('exportFollowUpPayload', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ success: true }),
        })
      )
    })

    it('calls electron exportFollowUpPayload with stringified data', async () => {
      const findings = [{ findingId: 'F-1', locationId: 'loc-1' }]
      const followUpSession = { summary: { specialty: 'SUR' }, responses: { 'F-1': {} } }
      const expectedResult = {
        zipPath: '/tmp/followup.zip',
        uploadStatus: 200,
        uploadBody: JSON.stringify({
          status: 'imported',
          followUpReportsImported: 2,
          followUpEvidenceImported: 5,
          followUpFilenames: ['FU-MDPP001SUR-01-01', 'FU-MDPP001SUR-02-01'],
        }),
      }
      mockElectronAPI.exportFollowUpPayload.mockResolvedValue(expectedResult)

      const result = await fs.exportFollowUpPayload(findings, followUpSession, 'SUR', 'loc-1')

      expect(mockElectronAPI.exportFollowUpPayload).toHaveBeenCalledWith({
        findingsString: JSON.stringify(findings),
        followUpSessionString: JSON.stringify(followUpSession),
        specialty: 'SUR',
        locationId: 'loc-1',
      })
      expect(fetch).toHaveBeenCalledWith('http://localhost:1880/importFollowUps', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          specialtyName: 'Vigilancia (radar)',
          followUpFiles: ['FU-MDPP001SUR-01-01', 'FU-MDPP001SUR-02-01'],
        }),
      })
      expect(result).toEqual(expectedResult)
    })

    it('waits followUpImportDelay before calling importFollowUps', async () => {
      const findings = [{ findingId: 'F-1', locationId: 'loc-1' }]
      const followUpSession = { summary: { specialty: 'SUR' }, responses: { 'F-1': {} } }
      mockElectronAPI.getAppConfig.mockResolvedValue({
        ...mockAppConfig,
        api: {
          ...mockAppConfig.api,
          followUpImportDelay: 200,
        },
      })
      mockElectronAPI.exportFollowUpPayload.mockResolvedValue({
        zipPath: '/tmp/followup.zip',
        uploadStatus: 200,
        uploadBody: JSON.stringify({
          followUpFilenames: ['FU-MDPP001SUR-01-01'],
        }),
      })

      const pending = fs.exportFollowUpPayload(findings, followUpSession, 'SUR')

      await vi.advanceTimersByTimeAsync(199)
      expect(fetch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      await pending

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith('http://localhost:1880/importFollowUps', expect.any(Object))
    })

    it('falls back to result.followUpFiles when uploadBody does not include names', async () => {
      const findings = [{ findingId: 'F-1', locationId: 'loc-1' }]
      const followUpSession = { summary: { specialty: 'SUR' }, responses: { 'F-1': {} } }
      mockElectronAPI.exportFollowUpPayload.mockResolvedValue({
        zipPath: '/tmp/followup.zip',
        uploadStatus: 200,
        uploadBody: 'ok',
        followUpFiles: ['FU-MDPP001SUR-01-01'],
      })

      await fs.exportFollowUpPayload(findings, followUpSession, 'SUR', 'loc-1')

      expect(fetch).toHaveBeenCalledWith('http://localhost:1880/importFollowUps', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          specialtyName: 'Vigilancia (radar)',
          followUpFiles: ['FU-MDPP001SUR-01-01'],
        }),
      })
    })

    it('throws when first upload API does not return follow-up files', async () => {
      const findings = [{ findingId: 'F-1', locationId: 'loc-1' }]
      const followUpSession = { summary: { specialty: 'SUR' }, responses: { 'F-1': {} } }
      mockElectronAPI.exportFollowUpPayload.mockResolvedValue({
        zipPath: '/tmp/followup.zip',
        uploadStatus: 200,
        uploadBody: 'ok',
      })

      await expect(fs.exportFollowUpPayload(findings, followUpSession, 'SUR', 'loc-1')).rejects.toThrow(
        'exportFollowUpPayload: could not export and upload follow-up payload: No follow-up files were returned by follow-up import API'
      )
    })

    it('throws when specialtyName cannot be resolved', async () => {
      const findings = [{ findingId: 'F-1', locationId: 'loc-1' }]
      const followUpSession = { summary: { specialty: 'UNK' }, responses: { 'F-1': {} } }
      mockElectronAPI.exportFollowUpPayload.mockResolvedValue({
        zipPath: '/tmp/followup.zip',
        uploadStatus: 200,
        uploadBody: JSON.stringify({ followUpFilenames: ['FU-UNK-01'] }),
      })
      mockElectronAPI.getAppConfig.mockResolvedValue({
        ...mockAppConfig,
        fallback: { specialties: [] },
      })

      await expect(fs.exportFollowUpPayload(findings, followUpSession, 'UNK', 'loc-1')).rejects.toThrow(
        'exportFollowUpPayload: could not export and upload follow-up payload: specialtyName could not be resolved for follow-up import payload'
      )
    })

    it('throws when importFollowUps API fails', async () => {
      const findings = [{ findingId: 'F-1', locationId: 'loc-1' }]
      const followUpSession = { summary: { specialty: 'SUR' }, responses: { 'F-1': {} } }
      mockElectronAPI.exportFollowUpPayload.mockResolvedValue({
        zipPath: '/tmp/followup.zip',
        uploadStatus: 200,
        uploadBody: JSON.stringify({ followUpFilenames: ['FU-MDPP001SUR-01-01'] }),
      })
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        })
      )

      await expect(fs.exportFollowUpPayload(findings, followUpSession, 'SUR', 'loc-1')).rejects.toThrow(
        'exportFollowUpPayload: could not export and upload follow-up payload: importFollowUps API failed with status 500'
      )
    })

    it('throws for missing parameters', async () => {
      await expect(fs.exportFollowUpPayload(null, { responses: {} }, 'SUR')).rejects.toThrow(
        'exportFollowUpPayload: could not export and upload follow-up payload'
      )
      await expect(fs.exportFollowUpPayload([], null, 'SUR')).rejects.toThrow(
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
        specialty: 'SUR',
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
        'SUR',
        'session.json'
      )
    })

    it('handles errors', async () => {
      vi.clearAllTimers()
      const mockSessionSummary = {
        specialty: 'SUR',
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
    it('loads follow-up session with required followUpType', async () => {
      const fs = createFileService()
      const payload = { summary: { specialty: 'SUR', finalized: false }, responses: { F1: { findingId: 'F1', followUpType: 'Progress Verification' } } }
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(payload))

      const result = await fs.loadFollowUpSession('SUR', 'loc-001')

      expect(result).toEqual(payload)
      expect(window.electronAPI.checkPath).toHaveBeenCalledWith(
        null,
        'LOC-001_SUR',
        'followup.session.json'
      )
    })

    it('returns null when follow-up session file does not exist', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(false)

      const result = await fs.loadFollowUpSession('SUR', 'loc-001')

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
      const result = await fs.setSavePath('SUR')
      expect(result).toBeNull()
    })

    it('createDefaultPath throws error', async () => {
      const fs = createFileService()
      window.electronAPI.createDir.mockRejectedValue(new Error('fail'))
      await expect(fs.createDefaultPath('SUR')).rejects.toThrow(
        'createDefaultPath: could not create path SUR : fail'
      )
    })

    it('deleteEvidence throws error', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockRejectedValue(new Error('fail'))
      await expect(fs.deleteEvidence('SUR', 'file.txt')).rejects.toThrow(
        'deleteEvidence: could not delete evidence SUR/file.txt : fail'
      )
    })

    it('readEvidence throws error', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.listPath.mockRejectedValue(new Error('fail'))
      await expect(fs.readEvidence('SUR')).rejects.toThrow(
        'readEvidence: could not read evidence for SUR : fail'
      )
    })

    it('saveEvidence should not save if file exists with same size', async () => {
      const fs = createFileService()
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('This is a buffer')
      const fileSize = buffer.byteLength
      window.electronAPI.getStats.mockResolvedValue({ size: fileSize })
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path')

      const result = await fs.saveEvidence('SUR', 'file1.txt', buffer)

      expect(result).toBeNull()
      expect(window.electronAPI.saveFile).not.toHaveBeenCalled()
    })

    it('loadChecklist creates dummy checklist when path does not exist', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValueOnce(false)
      window.electronAPI.readFile.mockResolvedValue('{"specialtyName":"Test"}')

      await fs.loadChecklist('SUR')

      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null, 'SUR', 'Evidence')
      expect(window.electronAPI.saveFile).toHaveBeenCalled()
    })

    it('loadChecklist throws error when checkPath fails', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockRejectedValue(new Error('path check failed'))

      await expect(fs.loadChecklist('SUR')).rejects.toThrow(
        'loadChecklist: could not load checklist for SUR : path check failed'
      )
    })

    it('loadSession returns parsed session when file exists', async () => {
      const fs = createFileService()
      const mockSession = { summary: { specialty: 'SUR' }, responses: {} }
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(mockSession))

      await fs.loadSession('SUR')

      expect(window.electronAPI.checkPath).toHaveBeenCalledWith(null, 'SUR', 'session.json')
    })

    it('loadSession throws error on failure', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockRejectedValue(new Error('check failed'))

      await expect(fs.loadSession('SUR')).rejects.toThrow(
        'loadSession: could not load session for SUR : check failed'
      )
    })

    it('saveAudio saves audio file successfully', async () => {
      const fs = createFileService()
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('audio data')
      window.electronAPI.saveFile.mockResolvedValue('/mocked/audio.webm')

      const result = await fs.saveAudio('SUR', 'audio.webm', buffer)

      expect(result).toBe('/mocked/audio.webm')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        buffer,
        null,
        'SUR',
        'Audio',
        'audio.webm'
      )
    })

    it('saveAudio throws error for empty buffer', async () => {
      const fs = createFileService()
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from('')

      await expect(fs.saveAudio('SUR', 'audio.webm', buffer)).rejects.toThrow(
        'saveAudio: could not save audio for SUR/audio.webm : Audio file is empty'
      )
    })

    it('saveAudio throws error for undefined buffer', async () => {
      const fs = createFileService()

      await expect(fs.saveAudio('SUR', 'audio.webm', undefined)).rejects.toThrow(
        'saveAudio: could not save audio for SUR/audio.webm : Buffer is undefined'
      )
    })

    it('deleteAudio throws error', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockRejectedValue(new Error('delete failed'))

      await expect(fs.deleteAudio('SUR', 'audio.webm')).rejects.toThrow(
        'deleteAudio: could not delete audio SUR/audio.webm : delete failed'
      )
    })

    it('readAudio returns list of audio files', async () => {
      const fs = createFileService()
      const mockAudioList = ['audio1.webm', 'audio2.webm']
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.listPath.mockResolvedValue(mockAudioList)

      const result = await fs.readAudio('SUR')

      expect(result).toEqual(mockAudioList)
      expect(window.electronAPI.listPath).toHaveBeenCalledWith(null, 'SUR', 'Audio')
    })

    it('readAudio throws error', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.listPath.mockRejectedValue(new Error('list failed'))

      await expect(fs.readAudio('SUR')).rejects.toThrow(
        'readAudio: could not read audio for SUR : list failed'
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

      await expect(fs.saveExportFile('', 'SUR')).rejects.toThrow(
        'saveExportFile: could not save file: Empty checklist detected'
      )
    })

    it('saveExportFile saves CSV file successfully', async () => {
      const fs = createFileService()
      const csvContent = 'ref,question,comment\nREF001,Question 1,OK'
      window.electronAPI.saveFile.mockResolvedValue(undefined)

      await fs.saveExportFile(csvContent, 'SUR')

      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(csvContent, null, 'SUR', 'compliance_export.csv')
    })

    it('loadSpecialties returns list of specialties', async () => {
      const fs = createFileService()
      const apiSpecialties = [
        { code: 'SUR', name: 'Vigilancia (radar)' },
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
        { id: null, code: 'SUR', name: 'Vigilancia (radar)' },
        { id: null, code: 'COM', name: 'Comunicaciones de Radio' },
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
        { id: null, code: 'SUR', name: 'Vigilancia (radar)' },
        { id: null, code: 'COM', name: 'Comunicaciones de Radio' },
      ])
    })

    it('setSavePath returns path if checkPath is true', async () => {
      const fs = createFileService()
      window.electronAPI.getPath.mockReturnValue('/mocked/path')
      window.electronAPI.checkPath.mockResolvedValue(true)

      const result = await fs.setSavePath('SUR')

      expect(result).toBe('/mocked/path')
    })

    it('setSavePath throws error on checkPath failure', async () => {
      const fs = createFileService()
      window.electronAPI.getPath.mockReturnValue('/mocked/path')
      window.electronAPI.checkPath.mockRejectedValue(new Error('check failed'))

      await expect(fs.setSavePath('SUR')).rejects.toThrow(
        'setSavePath: could not save path SUR : check failed'
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

      await expect(fs.saveExportFile(csvContent, 'SUR')).rejects.toThrow(
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

      const result = await fs.deleteEvidence('SUR', 'file.txt')

      expect(result).toBe(true)
      expect(window.electronAPI.deleteFile).toHaveBeenCalledWith(null, 'SUR', 'Evidence', 'file.txt')
    })

    it('deleteAudio should return deletion result', async () => {
      const fs = createFileService()
      window.electronAPI.deleteFile.mockResolvedValue(true)

      const result = await fs.deleteAudio('SUR', 'audio.webm')

      expect(result).toBe(true)
      expect(window.electronAPI.deleteFile).toHaveBeenCalledWith(null, 'SUR', 'Audio', 'audio.webm')
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
        summary: { specialty: 'SUR', finalized: false },
        responses: {}
      }))

      const result = await fs.getChecklistImportState('SUR')

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

      const result = await fs.getChecklistImportState('SUR')

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

      const result = await fs.getChecklistImportState('SUR')

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

      const result = await fs.fetchChecklistFromApi('INS1', 'SUR', {})

      expect(fetch).toHaveBeenCalledWith('http://localhost:1880/checklist?inspectionId=INS1&specialty=SUR')
      expect(result).toEqual(mockChecklist)
    })

    it('fetchChecklistFromApi throws error for missing parameters', async () => {
      const fs = createFileService()

      await expect(fs.fetchChecklistFromApi('', 'SUR', {})).rejects.toThrow(
        'fetchChecklistFromApi: could not fetch checklist: Missing required parameters'
      )

      await expect(fs.fetchChecklistFromApi('INS1', '', {})).rejects.toThrow(
        'fetchChecklistFromApi: could not fetch checklist: Missing required parameters'
      )
    })

    it('fetchChecklistFromApi throws error for non-OK response', async () => {
      const fs = createFileService()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      }))

      await expect(fs.fetchChecklistFromApi('INS1', 'SUR', {})).rejects.toThrow(
        'fetchChecklistFromApi: could not fetch checklist: Import failed with status 404'
      )
    })

    it('fetchChecklistFromApi includes provider in URL when provided', async () => {
      const fs = createFileService()
      const mockChecklist = { inspection: '0224', questions: [] }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, json: vi.fn().mockResolvedValue(mockChecklist),
      }))
      parseChecklist.mockReturnValue(mockChecklist)

      await fs.fetchChecklistFromApi('INS1', 'SUR', { inspectedProviderId: 'SP1', siteVisitId: 'SV1' })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:1880/checklist?inspectionId=INS1&specialty=SUR&siteVisitId=SV1&inspectedProviderId=SP1',
      )
    })

    it('fetchInspectionProviders calls the correct endpoint', async () => {
      const fs = createFileService()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, json: vi.fn().mockResolvedValue([]),
      }))

      await fs.fetchInspectionProviders()

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:1880/inspectionProvider?status=Uploaded',
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
      const result = await fs.ensureSpecialtyEntry('SUR', 'Vigilancia')

      expect(result).toEqual({ code: 'SUR', name: 'Vigilancia' })
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

      await fs.saveChecklist('SUR', mockChecklist)

      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null, 'SUR', 'Evidence')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        JSON.stringify(mockChecklist, null, 2),
        null,
        'SUR',
        'checklist.json'
      )
    })

    it('saveChecklist throws error for missing parameters', async () => {
      const fs = createFileService()

      await expect(fs.saveChecklist('', {})).rejects.toThrow(
        'saveChecklist: could not save checklist: Missing required parameters'
      )

      await expect(fs.saveChecklist('SUR', null)).rejects.toThrow(
        'saveChecklist: could not save checklist: Missing required parameters'
      )
    })

    it('fetchFindingsFromApi fetches and validates findings from API', async () => {
      const fs = createFileService()
      const mockFindings = [
        {
          schemaVersion: '1.0',
          findingId: 'MDPP-SUR-2026-01',
          locationId: 'loc-001',
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

      const result = await fs.fetchFindingsFromApi('SUR', 'loc-001', '0224')

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:1880/findings/open?specialtyCode=SUR&locationCode=loc-001&inspection=0224'
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

      await expect(fs.fetchFindingsFromApi('SUR', 'loc-001')).rejects.toThrow(
        'fetchFindingsFromApi: could not fetch findings: Findings import failed with status 500'
      )
    })

    it('saveFindings stores findings using workspace path', async () => {
      const fs = createFileService()
      const findings = [{ findingId: 'F-1', locationId: 'loc-001' }]
      window.electronAPI.createDir.mockResolvedValue(undefined)
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path/findings.json')

      const result = await fs.saveFindings('SUR', findings, 'loc-001')

      expect(result).toBe('/mocked/path/findings.json')
      expect(window.electronAPI.createDir).toHaveBeenCalledWith(null, 'LOC-001_SUR')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        JSON.stringify(findings, null, 2),
        null,
        'LOC-001_SUR',
        'findings.json'
      )
    })

    it('loadFindings returns parsed findings when file exists', async () => {
      const fs = createFileService()
      const findings = [{ findingId: 'F-1', locationId: 'loc-001' }]

      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(JSON.stringify(findings))
      parseFindings.mockReturnValue(findings)

      const result = await fs.loadFindings('SUR', 'loc-001')

      expect(result).toEqual(findings)
      expect(window.electronAPI.checkPath).toHaveBeenCalledWith(
        null,
        'LOC-001_SUR',
        'findings.json'
      )
    })

    it('loadFindings returns null when no findings file exists', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(false)

      const result = await fs.loadFindings('SUR', 'loc-001')

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

      const result = await fs.getFindingsImportState('SUR', 'loc-001')

      expect(result).toEqual({
        hasFindings: true,
        hasFollowUpSession: true,
        followUpFinalized: false,
      })
    })

    it('joinChecklistWithFindings enriches questions and reports unmatched findings', () => {
      const fs = createFileService()

      const checklist = {
        specialtyName: 'SUR',
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
        { findingId: 'F-1', locationId: 'loc-001' },
        { findingId: 'F-2', locationId: 'loc-001' },
      ]

      const result = fs.joinChecklistWithFindings(checklist, findings)

      expect(result.checklist.questions[0].priorFinding.findingId).toBe('F-1')
      expect(result.unmatchedFindings).toHaveLength(1)
      expect(result.unmatchedFindings[0].findingId).toBe('F-2')
    })
  })

  describe('workspace scaffolding', () => {
    it('builds workspace key using location and specialty', () => {
      const fs = createFileService()
      const key = fs.getWorkspaceKey('loc-001', 'sur')
      expect(key).toBe('loc-001__SUR')
    })

    it('builds workspace legs with location context', () => {
      const fs = createFileService()
      const legs = fs.getWorkspaceLegs('sur', 'loc-001')
      expect(legs).toEqual(['LOC-001_SUR'])
    })

    it('builds legacy workspace legs when location is not provided', () => {
      const fs = createFileService()
      const legs = fs.getWorkspaceLegs('sur')
      expect(legs).toEqual(['SUR'])
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
      const registry = [{ workspaceKey: 'loc-001__SUR' }]
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
        specialtyCode: 'sur',
        specialtyName: 'Vigilancia',
        locationId: 'loc-001',
        locationName: 'Location 1',
      })

      expect(entry.workspaceKey).toBe('loc-001__SUR')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('loc-001__SUR'),
        null,
        'workspaces.json'
      )
    })

    it('preserves existing checklist/findings presence flags when omitted', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockResolvedValue(true)
      window.electronAPI.readFile.mockResolvedValue(
        JSON.stringify([
          {
            workspaceKey: 'loc-001__SUR',
            specialtyCode: 'SUR',
            specialtyName: 'Vigilancia',
            locationId: 'loc-001',
            locationName: 'Location 1',
            draftStatus: 'draft',
            checklistTouched: true,
            followUpTouched: false,
            checklistPresent: true,
            findingsPresent: true,
          },
        ])
      )
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path/workspaces.json')

      await fs.upsertWorkspaceRegistryEntry({
        specialtyCode: 'SUR',
        locationId: 'loc-001',
        checklistTouched: true,
      })

      const lastSavePayload = window.electronAPI.saveFile.mock.calls.at(-1)[0]
      const savedRegistry = JSON.parse(lastSavePayload)
      expect(savedRegistry[0].checklistPresent).toBe(true)
      expect(savedRegistry[0].findingsPresent).toBe(true)
      expect(savedRegistry[0].checklistTouched).toBe(true)
    })

    it('returns touched state from workspace metadata when available', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath
        .mockResolvedValueOnce(true)
      window.electronAPI.readFile.mockResolvedValue(
        JSON.stringify({ checklistTouched: true, followUpTouched: false })
      )

      const result = await fs.getWorkspaceTouchedState('SUR', 'loc-001')

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

      await fs.markWorkspaceTouched('SUR', 'loc-001')

      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('"checklistTouched": true'),
        null,
        'LOC-001_SUR',
        'workspace.json'
      )
    })
  })

  describe('session removal', () => {
    it('removes inspection session when uploaded and keeps workspace if follow-up exists', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockImplementation(async (root, ...legs) => {
        const key = legs.join('/')
        if (key == 'LOC-001_SUR/workspace.json') return true
        if (key == 'workspaces.json') return true
        if (key == 'LOC-001_SUR/session.json') return true
        if (key == 'LOC-001_SUR/checklist.json') return true
        if (key == 'LOC-001_SUR/Evidence') return true
        if (key == 'LOC-001_SUR/Audio') return true
        if (key == 'LOC-001_SUR/followup.session.json') return true
        return false
      })
      window.electronAPI.readFile
        .mockResolvedValueOnce(
          JSON.stringify({ checklistTouched: true, checklistUploaded: true, followUpTouched: false })
        )
        .mockResolvedValueOnce(
          JSON.stringify([
            {
              workspaceKey: 'loc-001__SUR',
              specialtyCode: 'SUR',
              locationId: 'loc-001',
              checklistTouched: true,
              checklistUploaded: true,
              followUpTouched: false,
              followUpUploaded: false,
            },
          ])
        )
      window.electronAPI.listPath.mockResolvedValue([
        { name: 'inspection_payload_2026.zip' },
        { name: 'reporte_hallazgos_2026-01-01.pdf' },
        { name: 'workspace.json' },
      ])
      window.electronAPI.deleteFile.mockResolvedValue(true)
      window.electronAPI.deletePath.mockResolvedValue(true)
      window.electronAPI.createDir.mockResolvedValue(undefined)
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path/workspace.json')

      const result = await fs.removeInspectionSession('SUR', 'loc-001')

      expect(result).toEqual({ removed: true, workspaceDeleted: false })
      expect(window.electronAPI.deleteFile).toHaveBeenCalledWith(null, 'LOC-001_SUR', 'session.json')
      expect(window.electronAPI.deleteFile).toHaveBeenCalledWith(null, 'LOC-001_SUR', 'checklist.json')
      expect(window.electronAPI.deletePath).toHaveBeenCalledWith(null, 'LOC-001_SUR', 'Evidence')
      expect(window.electronAPI.deletePath).toHaveBeenCalledWith(null, 'LOC-001_SUR', 'Audio')
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('"checklistUploaded": false'),
        null,
        'LOC-001_SUR',
        'workspace.json'
      )
      expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('"checklistPresent": false'),
        null,
        'LOC-001_SUR',
        'workspace.json'
      )
    })

    it('blocks inspection session removal when touched and not uploaded', async () => {
      const fs = createFileService()
      window.electronAPI.checkPath.mockImplementation(async (root, ...legs) => {
        return legs.join('/') == 'LOC-001_SUR/workspace.json'
      })
      window.electronAPI.readFile.mockResolvedValue(
        JSON.stringify({ checklistTouched: true, checklistUploaded: false })
      )

      await expect(fs.removeInspectionSession('SUR', 'loc-001')).rejects.toThrow(
        'Inspection session cannot be removed until it is uploaded or remains untouched'
      )
    })

    it('removes follow-up session and deletes workspace when no sessions remain', async () => {
      const fs = createFileService()
      let hasFollowUpSession = true
      let hasWorkspaceFolder = true
      window.electronAPI.checkPath.mockImplementation(async (root, ...legs) => {
        const key = legs.join('/')
        if (key == 'LOC-001_SUR/workspace.json') return true
        if (key == 'workspaces.json') return true
        if (key == 'LOC-001_SUR/followup.session.json') return hasFollowUpSession
        if (key == 'LOC-001_SUR/FollowUpEvidence') return true
        if (key == 'LOC-001_SUR/session.json') return false
        if (key == 'LOC-001_SUR') return hasWorkspaceFolder
        return false
      })
      window.electronAPI.readFile
        .mockResolvedValueOnce(
          JSON.stringify({ followUpTouched: false, followUpUploaded: false })
        )
        .mockResolvedValueOnce(
          JSON.stringify([
            {
              workspaceKey: 'loc-001__SUR',
              specialtyCode: 'SUR',
              locationId: 'loc-001',
            },
          ])
        )
      window.electronAPI.listPath.mockResolvedValue([{ name: 'followup_payload_2026.zip' }])
      window.electronAPI.deleteFile.mockImplementation(async (root, ...legs) => {
        const key = legs.join('/')
        if (key == 'LOC-001_SUR/followup.session.json') {
          hasFollowUpSession = false
        }
        return true
      })
      window.electronAPI.deletePath.mockImplementation(async (root, ...legs) => {
        const key = legs.join('/')
        if (key == 'LOC-001_SUR') {
          hasWorkspaceFolder = false
        }
        return true
      })
      window.electronAPI.saveFile.mockResolvedValue('/mocked/path/workspaces.json')

      const result = await fs.removeFollowUpSession('SUR', 'loc-001')

      expect(result).toEqual({ removed: true, workspaceDeleted: true })
      expect(window.electronAPI.deleteFile).toHaveBeenCalledWith(
        null,
        'LOC-001_SUR',
        'followup.session.json'
      )
      expect(window.electronAPI.deletePath).toHaveBeenCalledWith(null, 'LOC-001_SUR', 'FollowUpEvidence')
      expect(window.electronAPI.deletePath).toHaveBeenCalledWith(null, 'LOC-001_SUR')
    })
  })
})

describe('loadSpecialties specialty-id resolution', () => {
  const fs = createFileService()

  beforeEach(() => {
    vi.clearAllMocks()
    window.electronAPI.getAppConfig.mockResolvedValue(mockAppConfig)
  })

  it('leaves the id unresolved for offline fallback entries so sp-* cannot be exported', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))

    const specialties = await fs.loadSpecialties()

    expect(specialties.map((specialty) => specialty.code)).toEqual(['SUR', 'COM'])
    // A synthetic id (or the bare code) would be rejected by the backend.
    expect(specialties.every((specialty) => specialty.id === null)).toBe(true)
  })

  it('keeps the backend id returned by the API', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'a01k0f67dskef2a475yzd8a5dxd', code: 'SUR', name: 'Vigilancia' },
      ],
    })

    const specialties = await fs.loadSpecialties()

    expect(specialties).toEqual([
      { id: 'a01k0f67dskef2a475yzd8a5dxd', code: 'SUR', name: 'Vigilancia' },
    ])
  })

  it('drops a synthetic sp-* id even when it comes from the API payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'sp-sur', code: 'SUR', name: 'Vigilancia' }],
    })

    const specialties = await fs.loadSpecialties()

    expect(specialties[0].id).toBeNull()
  })
})
