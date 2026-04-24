// tests/ipcHandles.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { setupIpcHandles } from '../ipc/ipcHandles'
import * as fileOps from '../utils/fileOps'
import * as fs from 'node:fs/promises'
import { logger } from '../utils/logger'
import path from 'node:path'
import JSZip from 'jszip'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mocked/documents') },
  ipcMain: { handle: vi.fn() },
}))
vi.mock('../utils/fileOps', { spy: true })
vi.mock('../utils/logger')
vi.mock('node:fs/promises')
vi.mock('../utils/pdfGenerator', () => ({
  generateFindingsReport: vi.fn().mockResolvedValue('/path/to/report.pdf'),
}))

// Mock safeJoin to return a proper path
vi.mock('../utils/fileSec', () => ({
  safeJoin: vi.fn((base, inputs) => {
    if (typeof base !== 'string') {
      throw new Error(`safeJoin: Illegal path name: ${base}`)
    }
    // Handle both array and string inputs
    const inputArray = Array.isArray(inputs) ? inputs : [inputs]
    if (!inputArray) {
      throw new Error(`safeJoin: Illegal path name: ${base},${inputs}`)
    }
    // Check for ..
    if (inputArray.some((leg) => leg && leg.includes('..'))) {
      throw new Error(`safeJoin: Illegal path name: ${base},${inputArray.join(',')}`)
    }
    return path.resolve(base, ...inputArray)
  }),
}))

import { safeJoin } from '../utils/fileSec'

describe('ipcHandles', () => {
  let handles = {}

  beforeEach(() => {
    vi.clearAllMocks()
    ipcMain.handle.mockImplementation((channel, handler) => {
      handles[channel] = handler
    })
    setupIpcHandles(ipcMain)
  })

  describe('check-path', () => {
    it('calls fileExists with correct path', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(true)
      const result = await handles['check-path']({}, '/mocked/path', ['sub', 'file.txt'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub', 'file.txt'])
      expect(fileOps.fileExists).toHaveBeenCalledWith('/mocked/path/sub/file.txt')
      expect(result).toBe(true)
    })

    it('uses defaultSavePath when filePath is null', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(true)
      const result = await handles['check-path']({}, null, ['file.txt'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/documents/Current_inspection', ['file.txt'])
      expect(result).toBe(true)
    })

    it('handles ENOENT error', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(false) // ENOENT case
      const result = await handles['check-path']({}, '/mocked/path', ['file.txt'])
      expect(result).toBe(false)
    })

    it('handles invalid path with ..', async () => {
      await expect(handles['check-path']({}, '/mocked/path', ['../file.txt'])).rejects.toThrow(
        'Illegal path name'
      )
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'check-path: Could not assess presence of file /mocked/path ../file.txt: safeJoin: Illegal path name:'
        )
      )
    })

    it('handles non-string filePath', async () => {
      await expect(handles['check-path']({}, 123, ['file.txt'])).rejects.toThrow(
        'safeJoin: Illegal path name: 123'
      )
      expect(safeJoin).toHaveBeenCalledWith(123, ['file.txt'])
      expect(safeJoin).toThrow('safeJoin: Illegal path name:')
      //expect(fileOps.fileExists).toHaveBeenCalledWith('/mocked/path/sub/file.txt');
    })
  })

  describe('get-path', () => {
    it('returns constructed path', async () => {
      const result = await handles['get-path']({}, '/mocked/path', ['sub', 'file.txt'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub', 'file.txt'])
      expect(result).toBe('/mocked/path/sub/file.txt')
    })

    it('handles empty pathLegs', async () => {
      const result = await handles['get-path']({}, '/mocked/path', [])
      expect(result).toBe('/mocked/path')
    })

    it('handles path traversal', async () => {
      await expect(handles['get-path']({}, '/mocked/path', ['../file.txt'])).rejects.toThrow(
        'safeJoin: Illegal path name:'
      )
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'create-dir: Could not create directory /mocked/path ../file.txt : safeJoin: Illegal path name:'
        )
      )
    })
  })

  describe('get-stats', () => {
    it('returns file stats', async () => {
      const stats = { size: 1024, mtime: new Date() }
      vi.spyOn(fileOps, 'getFileStats').mockResolvedValue(stats)
      const result = await handles['get-stats']({}, '/mocked/path', ['file.txt'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.txt'])
      expect(fileOps.getFileStats).toHaveBeenCalledWith('/mocked/path/file.txt')
      expect(result).toBe(stats)
    })

    it('handles case of a null directory path', async () => {
      const stats = { size: 1024, mtime: new Date() }
      vi.spyOn(fileOps, 'getFileStats').mockResolvedValue(stats)
      const result = await handles['get-stats']({}, null, ['file.txt'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/documents/Current_inspection', ['file.txt'])
      expect(fileOps.getFileStats).toHaveBeenCalledWith(
        '/mocked/documents/Current_inspection/file.txt'
      )
      expect(result).toBe(stats)
    })

    it('returns null for ENOENT', async () => {
      vi.spyOn(fileOps, 'getFileStats').mockResolvedValue(null)
      const result = await handles['get-stats']({}, '/mocked/path', ['file.txt'])
      expect(result).toBe(null)
    })

    it('handles errors', async () => {
      vi.spyOn(fileOps, 'getFileStats').mockRejectedValue(new Error('Permission denied'))
      await expect(handles['get-stats']({}, '/mocked/path', ['file.txt'])).rejects.toThrow(
        'Permission denied'
      )
      expect(logger.error).toHaveBeenCalledWith(
        'get-stats: Could not stat file /mocked/path file.txt : Permission denied'
      )
    })
  })

  describe('create-dir', () => {
    it('creates directory', async () => {
      vi.spyOn(fileOps, 'ensureDir').mockResolvedValue('/mocked/path/sub')
      await handles['create-dir']({}, '/mocked/path', ['sub'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub'])
      expect(fileOps.ensureDir).toHaveBeenCalledWith('/mocked/path/sub')
    })

    it('handles existing directory', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(true)
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
      await handles['create-dir']({}, '/mocked/path', ['sub'])
      expect(fs.mkdir).not.toHaveBeenCalled()
    })

    it('handles errors', async () => {
      vi.spyOn(fileOps, 'ensureDir').mockRejectedValue(new Error('Dir creation failed'))
      await expect(handles['create-dir']({}, '/mocked/path', ['sub'])).rejects.toThrow(
        'Dir creation failed'
      )
      expect(logger.error).toHaveBeenCalledWith(
        'create-dir: Could not create directory /mocked/path sub : Dir creation failed'
      )
    })
  })

  describe('list-path', () => {
    it('lists directory contents', async () => {
      const files = [{ name: 'file.txt', URL: '/mocked/path/sub/file.txt', count: 0 }]
      vi.spyOn(fileOps, 'listDir').mockResolvedValue(files)
      const result = await handles['list-path']({}, '/mocked/path', ['sub'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub'])
      expect(fileOps.listDir).toHaveBeenCalledWith('/mocked/path/sub')
      expect(result).toEqual(files)
    })

    it('handles non-existent directory', async () => {
      vi.spyOn(fileOps, 'listDir').mockRejectedValue(
        new Error('readDir: Directory does not exist: /mocked/path/sub')
      )
      await expect(handles['list-path']({}, '/mocked/path', ['sub'])).rejects.toThrow(
        'Directory does not exist'
      )
      expect(logger.error).toHaveBeenCalledWith(
        'list-file: Could not read directory /mocked/path sub : readDir: Directory does not exist: /mocked/path/sub'
      )
    })
  })

  describe('read-file', () => {
    it('reads file content', async () => {
      const content = '{"key": "value"}'
      vi.spyOn(fileOps, 'readFile').mockResolvedValue(content)
      const result = await handles['read-file']({}, '/mocked/path', ['file.json'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.json'])
      expect(fileOps.readFile).toHaveBeenCalledWith('/mocked/path/file.json')
      expect(result).toBe(content)
    })

    it('handles non-existent file', async () => {
      vi.spyOn(fileOps, 'readFile').mockRejectedValue(
        new Error('readFile: File does not exist: /mocked/path/file.json')
      )
      await expect(handles['read-file']({}, '/mocked/path', ['file.json'])).rejects.toThrow(
        'File does not exist'
      )
      expect(logger.error).toHaveBeenCalledWith(
        'read-file: Could not read file /mocked/path file.json : readFile: File does not exist: /mocked/path/file.json'
      )
    })
  })

  describe('save-file', () => {
    it('throws error on empty file', async () => {
      const errorMessage =
        'ipcHandles.save-file: Could not save file /mocked/path file.txt : Buffer is empty'
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt')
      await expect(handles['save-file']({}, '', '/mocked/path', ['file.txt'])).rejects.toThrowError(
        errorMessage
      )
    })

    it('throws error on undefined file data', async () => {
      const errorMessage =
        'ipcHandles.save-file: Could not save file /mocked/path file.txt : Invalid buffer'
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt')
      await expect(
        handles['save-file']({}, undefined, '/mocked/path', ['file.txt'])
      ).rejects.toThrowError(errorMessage)
    })

    it('saves string data', async () => {
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt')
      const result = await handles['save-file']({}, 'test data', '/mocked/path', ['file.txt'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.txt'])
      expect(fileOps.saveFile).toHaveBeenCalledWith('/mocked/path/file.txt', 'test data')
      expect(result).toBe('/mocked/path/file.txt')
    })

    it('saves Buffer data', async () => {
      // eslint-disable-next-line no-undef
      const buffer = Buffer.from([0x74, 0x65, 0x73, 0x74]) // 'test'
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt')
      const result = await handles['save-file']({}, buffer, '/mocked/path', ['file.txt'])
      expect(fileOps.saveFile).toHaveBeenCalledWith('/mocked/path/file.txt', buffer)
      expect(result).toBe('/mocked/path/file.txt')
    })

    it('handles invalid data', async () => {
      vi.spyOn(fileOps, 'saveFile').mockRejectedValue(new Error('Invalid buffer'))
      await expect(handles['save-file']({}, {}, '/mocked/path', ['file.txt'])).rejects.toThrow(
        'Invalid buffer'
      )
      expect(logger.error).toHaveBeenCalledWith(
        'save-file: Could not save file /mocked/path file.txt : Invalid buffer'
      )
    })
  })

  describe('delete-file', () => {
    it('deletes file', async () => {
      vi.spyOn(fileOps, 'deleteFile').mockResolvedValue(true)
      const result = await handles['delete-file']({}, '/mocked/path', ['file.txt'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.txt'])
      expect(fileOps.deleteFile).toHaveBeenCalledWith('/mocked/path/file.txt')
      expect(result).toBe(true)
    })

    it('handles errors', async () => {
      vi.spyOn(fileOps, 'deleteFile').mockRejectedValue(new Error('Delete failed'))
      await expect(handles['delete-file']({}, '/mocked/path', ['file.txt'])).rejects.toThrow(
        'Delete failed'
      )
      expect(logger.error).toHaveBeenCalledWith(
        'delete-file: Could not delete file /mocked/path file.txt : Delete failed'
      )
    })
  })

  describe('delete-path', () => {
    it('deletes directory recursively', async () => {
      const result = await handles['delete-path']({}, '/mocked/path', ['workspace', 'Evidence'])
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['workspace', 'Evidence'])
      expect(result).toBe(true)
    })

    it('rejects when path segments are missing', async () => {
      await expect(handles['delete-path']({}, '/mocked/path', [])).rejects.toThrow(
        'Missing required path segments for delete-path'
      )
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('delete-path: Could not delete path /mocked/path')
      )
    })
  })

  describe('get-full-path', () => {
    it('returns full path with all components', async () => {
      const result = await handles['get-full-path']({}, '/mocked/path', ['subdir'], 'file.pdf')
      expect(safeJoin).toHaveBeenCalledTimes(2)
      expect(result).toBe('/mocked/path/subdir/file.pdf')
    })

    it('uses defaultSavePath when filePath is null', async () => {
      const result = await handles['get-full-path']({}, null, ['subdir'], 'file.pdf')
      expect(safeJoin).toHaveBeenCalledWith('/mocked/documents/Current_inspection', ['subdir'])
      expect(result).toBe('/mocked/documents/Current_inspection/subdir/file.pdf')
    })

    it('handles empty pathLegs', async () => {
      const result = await handles['get-full-path']({}, '/mocked/path', [], 'file.pdf')
      expect(result).toBe('/mocked/path/file.pdf')
    })

    it('handles path traversal attempts', async () => {
      await expect(
        handles['get-full-path']({}, '/mocked/path', ['../illegal'], 'file.pdf')
      ).rejects.toThrow('safeJoin: Illegal path name')
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('get-full-path'))
    })
  })

  describe('generate-pdf', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('generates PDF with provided parameters', async () => {
      const params = {
        checklistString: JSON.stringify({ inspection: '1125', questions: [] }),
        sessionString: JSON.stringify({ responses: {} }),
        specialty: 'Vigilancia',
        outputPath: '/path/to/report.pdf',
      }

      const result = await handles['generate-pdf']({}, params)

      expect(result).toBe('/path/to/report.pdf')
    })

    it('handles missing parameters', async () => {
      await expect(
        handles['generate-pdf'](
          {},
          {
            checklistString: JSON.stringify({ questions: [] }),
            // missing sessionString, specialty, outputPath
          }
        )
      ).rejects.toThrow('Missing required parameters')
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('generate-pdf'))
    })

    it('handles PDF generation errors', async () => {
      // Mock generateFindingsReport to reject with an error

      const params = {
        checklistString: JSON.stringify({ inspection: '1125', questions: [] }),
        sessionString: JSON.stringify({ responses: {} }),
        specialty: 'Vigilancia',
        outputPath: '/path/to/report.pdf',
      }

      // This should work with mocked pdfkit, just verify no error
      const result = await handles['generate-pdf']({}, params)
      expect(result).toBeDefined()
    })

    it('handles null session parameter', async () => {
      await expect(
        handles['generate-pdf'](
          {},
          {
            checklist: { questions: [] },
            session: null,
            specialty: 'Test',
            outputPath: '/path/to/report.pdf',
          }
        )
      ).rejects.toThrow('Missing required parameters')
    })

    it('handles null outputPath parameter', async () => {
      await expect(
        handles['generate-pdf'](
          {},
          {
            checklist: { questions: [] },
            session: { responses: {} },
            specialty: 'Test',
            outputPath: null,
          }
        )
      ).rejects.toThrow('Missing required parameters')
    })
  })

  describe('export-inspection-payload', () => {
    beforeEach(() => {
      vi.spyOn(fileOps, 'ensureDir').mockResolvedValue(undefined)
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(false)
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/payload.zip')
    })

    it('creates zip and posts payload to API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('ok'),
      })

      const checklist = {
        inspection: '0224',
        providerId: 'provider-1',
        locationId: 'loc-1',
        location: 'Test Location',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        questions: [{ id: 'q1', question: 'Question?', verification: 'Verify', sequence: '0010' }],
      }
      const session = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          1: {
            id: 'q1',
            compliance: 'Non-Compliant',
            nonConformityDetails: { description: 'Issue found' },
          },
        },
      }

      const result = await handles['export-inspection-payload']({}, {
        checklistString: JSON.stringify(checklist),
        sessionString: JSON.stringify(session),
        specialty: 'VIG',
      })

      expect(fileOps.saveFile).toHaveBeenCalled()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/inspection-import',
        expect.objectContaining({ method: 'POST' })
      )
      const zipBuffer = fileOps.saveFile.mock.calls.at(-1)[1]
      const zip = await JSZip.loadAsync(zipBuffer)
      const checklistJson = JSON.parse(await zip.file('checklist.json').async('string'))
      expect(checklistJson.checklist.completionDate).toBe('2026-03-22')
      expect(result).toEqual(
        expect.objectContaining({
          uploadStatus: 200,
          findingsCount: 1,
        })
      )
    })

    it('throws when import API returns non-OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('bad request'),
      })

      const checklist = {
        inspection: '0224',
        providerId: 'provider-1',
        locationId: 'loc-1',
        location: 'Test Location',
        startDate: '2026-03-20',
        questions: [{ id: 'q1', question: 'Question?', verification: 'Verify', sequence: '0010' }],
      }
      const session = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          1: {
            id: 'q1',
            compliance: 'Non-Compliant',
            nonConformityDetails: { description: 'Issue found' },
          },
        },
      }

      await expect(
        handles['export-inspection-payload']({}, {
          checklistString: JSON.stringify(checklist),
          sessionString: JSON.stringify(session),
          specialty: 'VIG',
        })
      ).rejects.toThrow('Import API failed with status 400')
    })

    it('includes all evidence files for a question in checklist payload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('ok'),
      })

      const checklist = {
        inspection: 'MDPP-2026-01',
        specialtyId: 'a01k0f67dskef2a475yzd8a5dxd',
        specialtyCode: 'VIG',
        specialtyName: 'Sistemas de Vigilancia',
        providerId: 'provider-1',
        locationId: 'loc-1',
        location: 'Test Location',
        startDate: '2026-03-20',
        questions: [
          { id: 'q1', code: 'VIG-0054', question: 'Question?', verification: 'Verify' },
        ],
      }
      const session = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          'VIG-0054': {
            id: 'q1',
            code: 'VIG-0054',
            compliance: 'Compliant',
            evidence: [
              { name: 'photo-1.jpg' },
              { name: 'voice-1.webm' },
              { name: 'note.pdf' },
            ],
          },
        },
      }

      await handles['export-inspection-payload']({}, {
        checklistString: JSON.stringify(checklist),
        sessionString: JSON.stringify(session),
        specialty: 'VIG',
      })

      const zipBuffer = fileOps.saveFile.mock.calls.at(-1)[1]
      const zip = await JSZip.loadAsync(zipBuffer)
      const checklistJson = JSON.parse(await zip.file('checklist.json').async('string'))

      expect(checklistJson.checklist.specialtyId).toBe('a01k0f67dskef2a475yzd8a5dxd')
      expect(checklistJson.checklist.specialtyCode).toBe('VIG')
      expect(checklistJson.checklist.specialtyName).toBe('Sistemas de Vigilancia')
      expect(checklistJson.items[0].evidenceItems).toEqual([
        {
          evidenceId: 'EV-0001-01',
          evidenceType: 'image',
          source: 'photo-1.jpg',
          evidenceRole: 'Compliance Evidence',
        },
        {
          evidenceId: 'EV-0001-02',
          evidenceType: 'audio',
          source: 'voice-1.webm',
          evidenceRole: 'Compliance Evidence',
        },
        {
          evidenceId: 'EV-0001-03',
          evidenceType: 'document',
          source: 'note.pdf',
          evidenceRole: 'Compliance Evidence',
        },
      ])
    })

    it('maps checklist nominalRisk and finding riskClassification correctly', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('ok'),
      })

      const checklist = {
        inspection: 'MDPP-2026-01',
        specialtyId: 'a01k0f67dskef2a475yzd8a5dxd',
        specialtyCode: 'VIG',
        specialtyName: 'Sistemas de Vigilancia',
        providerId: 'provider-1',
        locationId: 'MDPP',
        locationName: 'Test Location',
        startDate: '2026-03-20',
        questions: [
          {
            id: 'q1',
            code: 'VIG-0001',
            question: 'Question 1?',
            verification: 'Verify 1',
            riskLevel: 'High',
          },
          {
            id: 'q2',
            code: 'VIG-0002',
            question: 'Question 2?',
            verification: 'Verify 2',
            riskLevel: 'Medium',
          },
        ],
      }

      const session = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          'VIG-0001': {
            id: 'q1',
            code: 'VIG-0001',
            compliance: 'Non-Compliant',
            nonConformityDetails: { description: 'Issue 1' },
          },
          'VIG-0002': {
            id: 'q2',
            code: 'VIG-0002',
            compliance: 'Non-Compliant',
            nonConformityDetails: { description: 'Issue 2', riskLevel: 'Critical' },
          },
        },
      }

      await handles['export-inspection-payload']({}, {
        checklistString: JSON.stringify(checklist),
        sessionString: JSON.stringify(session),
        specialty: 'VIG',
      })

      const zipBuffer = fileOps.saveFile.mock.calls.at(-1)[1]
      const zip = await JSZip.loadAsync(zipBuffer)
      const checklistJson = JSON.parse(await zip.file('checklist.json').async('string'))
      const findingsJson = JSON.parse(await zip.file('findings.json').async('string'))

      expect(checklistJson.items[0].nominalRisk).toBe('High')
      expect(checklistJson.items[1].nominalRisk).toBe('Medium')
      expect(findingsJson[0].finding.riskClassification).toBe('High')
      expect(findingsJson[1].finding.riskClassification).toBe('Critical')
    })
  })

  describe('export-follow-up-payload', () => {
    beforeEach(() => {
      vi.spyOn(fileOps, 'ensureDir').mockResolvedValue(undefined)
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(false)
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/followup.zip')
    })

    it('creates zip and posts follow-up payload to API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('ok'),
      })

      const findings = [
        {
          schemaVersion: '1.0',
          finding: {
            findingId: 'MDPP001-VIG-01',
            domain: 'VIG',
            providerId: 'provider-1',
            locationId: 'loc-1',
            locationName: 'Test Location',
            itemId: 'q1',
            description: 'Issue found',
          },
        },
      ]
      const followUpSession = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          'MDPP001-VIG-01': {
            findingId: 'MDPP001-VIG-01',
            followUpType: 'Closure Verification',
            percentComplete: 100,
            effectivenessConfirmed: true,
          },
        },
      }

      const result = await handles['export-follow-up-payload']({}, {
        findingsString: JSON.stringify(findings),
        followUpSessionString: JSON.stringify(followUpSession),
        specialty: 'VIG',
        locationId: 'loc-1',
      })

      expect(fileOps.saveFile).toHaveBeenCalled()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/followup-import',
        expect.objectContaining({ method: 'POST' })
      )

      const zipBuffer = fileOps.saveFile.mock.calls.at(-1)[1]
      const zip = await JSZip.loadAsync(zipBuffer)
      const reportsJson = JSON.parse(await zip.file('followup-reports.json').async('string'))
      expect(reportsJson[0].followUpReport.followUpId).toBe('FU-MDPP001VIG-01-260321')

      expect(result).toEqual(
        expect.objectContaining({
          uploadStatus: 200,
          reportsCount: 1,
        })
      )
    })

    it('throws when follow-up import API returns non-OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('bad request'),
      })

      const findings = [
        {
          schemaVersion: '1.0',
          finding: {
            findingId: 'MDPP001-VIG-01',
            domain: 'VIG',
            providerId: 'provider-1',
            locationId: 'loc-1',
            locationName: 'Test Location',
            itemId: 'q1',
            description: 'Issue found',
          },
        },
      ]
      const followUpSession = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          'MDPP001-VIG-01': {
            findingId: 'MDPP001-VIG-01',
            followUpType: 'Progress Verification',
            percentComplete: 10,
            effectivenessConfirmed: null,
          },
        },
      }

      await expect(
        handles['export-follow-up-payload']({}, {
          findingsString: JSON.stringify(findings),
          followUpSessionString: JSON.stringify(followUpSession),
          specialty: 'VIG',
          locationId: 'loc-1',
        })
      ).rejects.toThrow('Follow-up import API failed with status 400')
    })

    it('maps follow-up responses using response findingId when response key differs', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('ok'),
      })

      const findings = [
        {
          schemaVersion: '1.0',
          finding: {
            findingId: 'MDPP001-VIG-02',
            domain: 'VIG',
            providerId: 'provider-1',
            locationId: 'MDPP',
            locationName: 'Test Location',
            itemId: 'q2',
            description: 'Issue found',
          },
        },
      ]
      const followUpSession = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          orphan_key: {
            findingId: 'MDPP001-VIG-02',
            followUpType: 'Progress Verification',
            percentComplete: 20,
            effectivenessConfirmed: null,
          },
        },
      }

      const result = await handles['export-follow-up-payload']({}, {
        findingsString: JSON.stringify(findings),
        followUpSessionString: JSON.stringify(followUpSession),
        specialty: 'VIG',
        locationId: 'MDPP',
      })

      expect(result).toEqual(
        expect.objectContaining({
          uploadStatus: 200,
          reportsCount: 1,
        })
      )
    })

    it('accepts flat findings payload by normalizing wrappers', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('ok'),
      })

      const findings = [
        {
          findingId: 'MDPP001-VIG-02',
          domain: 'VIG',
          providerId: 'provider-1',
          locationId: 'MDPP',
          locationName: 'Test Location',
          itemId: 'q2',
          description: 'Issue found',
        },
      ]
      const followUpSession = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          'MDPP001-VIG-02': {
            findingId: 'MDPP001-VIG-02',
            followUpType: 'Progress Verification',
            percentComplete: 5,
            effectivenessConfirmed: null,
          },
        },
      }

      const result = await handles['export-follow-up-payload']({}, {
        findingsString: JSON.stringify(findings),
        followUpSessionString: JSON.stringify(followUpSession),
        specialty: 'VIG',
        locationId: 'MDPP',
      })

      expect(result).toEqual(
        expect.objectContaining({
          uploadStatus: 200,
          reportsCount: 1,
        })
      )
    })

    it('allows findings without domain and strips invalid riskLevel', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('ok'),
      })

      const findings = [
        {
          findingId: 'MDPP001-VIG-03',
          specialtyId: 'a01k0f67dskef2a475yzd8a5dxd',
          providerId: 'provider-1',
          locationId: 'MDPP',
          locationName: 'Test Location',
          itemId: 'q3',
          description: 'Issue found',
          riskLevel: 'Unknown',
        },
      ]
      const followUpSession = {
        summary: { specialty: 'VIG', lastUpdated: '2026-03-21T10:00:00.000Z' },
        responses: {
          'MDPP001-VIG-03': {
            findingId: 'MDPP001-VIG-03',
            followUpType: 'Progress Verification',
            percentComplete: 80,
            effectivenessConfirmed: null,
          },
        },
      }

      const result = await handles['export-follow-up-payload']({}, {
        findingsString: JSON.stringify(findings),
        followUpSessionString: JSON.stringify(followUpSession),
        specialty: 'VIG',
        locationId: 'MDPP',
      })

      expect(result).toEqual(
        expect.objectContaining({
          uploadStatus: 200,
          reportsCount: 1,
        })
      )
    })

  })
})
