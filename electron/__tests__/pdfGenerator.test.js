import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('pdfGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateFindingsReport', () => {
    it('exports a function', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      expect(typeof generateFindingsReport).toBe('function')
    })

    it('returns a Promise', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const mockChecklistData = {
        specialtyName: 'Test Specialty',
        inspection: 'INSP001',
        location: 'Test Location',
        startDate: '2024-01-15',
        questions: [],
      }

      const mockSessionData = {
        summary: {
          specialty: 'Test Specialty',
          finalized: false,
          lastUpdated: '2024-01-15T10:00:00Z',
          generalComments: 'Test',
        },
        responses: {},
      }

      const checklistString = JSON.stringify(mockChecklistData)
      const sessionString = JSON.stringify(mockSessionData)
      const outputPath = '/tmp/test-report.pdf'

      const result = generateFindingsReport({
        checklistString,
        sessionString,
        outputPath,
      })

      expect(result).toBeInstanceOf(Promise)
    })

    it('should reject with error when checklist JSON is invalid', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const invalidChecklistString = 'invalid json'
      const validSessionString = JSON.stringify({
        summary: { generalComments: 'test' },
        responses: {},
      })
      const outputPath = '/tmp/test-report.pdf'

      await expect(
        generateFindingsReport({
          checklistString: invalidChecklistString,
          sessionString: validSessionString,
          outputPath,
        })
      ).rejects.toThrow()
    })

    it('should reject with error when session JSON is invalid', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const validChecklistString = JSON.stringify({
        specialtyName: 'Test',
        inspection: 'INSP001',
        location: 'Test Location',
        startDate: '2024-01-15',
        questions: [],
      })
      const invalidSessionString = 'invalid json'
      const outputPath = '/tmp/test-report.pdf'

      await expect(
        generateFindingsReport({
          checklistString: validChecklistString,
          sessionString: invalidSessionString,
          outputPath,
        })
      ).rejects.toThrow()
    })

    it('should require checklist string parameter', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const validSessionString = JSON.stringify({
        summary: { generalComments: 'test' },
        responses: {},
      })
      const outputPath = '/tmp/test-report.pdf'

      await expect(
        generateFindingsReport({
          checklistString: undefined,
          sessionString: validSessionString,
          outputPath,
        })
      ).rejects.toThrow()
    })

    it('should require session string parameter', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const validChecklistString = JSON.stringify({
        specialtyName: 'Test',
        inspection: 'INSP001',
        location: 'Test Location',
        startDate: '2024-01-15',
        questions: [],
      })
      const outputPath = '/tmp/test-report.pdf'

      await expect(
        generateFindingsReport({
          checklistString: validChecklistString,
          sessionString: undefined,
          outputPath,
        })
      ).rejects.toThrow()
    })

    it('should accept valid checklist with findings', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const mockChecklistData = {
        specialtyName: 'Test Specialty',
        inspection: 'INSP001',
        location: 'Test Location',
        startDate: '2024-01-15',
        questions: [
          {
            id: 'q1',
            topic: 'Topic 1',
            reference: 'REF001',
            question: 'Test question?',
            verification: 'Test verification',
          },
        ],
      }

      const mockSessionData = {
        summary: {
          specialty: 'Test Specialty',
          finalized: false,
          lastUpdated: '2024-01-15T10:00:00Z',
          generalComments: 'Found some issues',
        },
        responses: {
          1: {
            id: '1',
            compliance: 'Non-compliant',
            comments: 'Needs fixing',
            nonConformity: 'Issue found',
            evidence: [],
          },
        },
      }

      const checklistString = JSON.stringify(mockChecklistData)
      const sessionString = JSON.stringify(mockSessionData)
      const outputPath = '/tmp/test-report-with-findings.pdf'

      const result = generateFindingsReport({
        checklistString,
        sessionString,
        outputPath,
      })

      expect(result).toBeInstanceOf(Promise)
    })

    it('should accept valid checklist without findings', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const mockChecklistData = {
        specialtyName: 'Test Specialty',
        inspection: 'INSP001',
        location: 'Test Location',
        startDate: '2024-01-15',
        questions: [
          {
            id: 'q1',
            topic: 'Topic 1',
            reference: 'REF001',
            question: 'Test question?',
            verification: 'Test verification',
          },
        ],
      }

      const mockSessionData = {
        summary: {
          specialty: 'Test Specialty',
          finalized: false,
          lastUpdated: '2024-01-15T10:00:00Z',
          generalComments: 'All good',
        },
        responses: {
          1: {
            id: '1',
            compliance: 'Compliant',
            comments: 'OK',
            evidence: [],
          },
        },
      }

      const checklistString = JSON.stringify(mockChecklistData)
      const sessionString = JSON.stringify(mockSessionData)
      const outputPath = '/tmp/test-report-no-findings.pdf'

      const result = generateFindingsReport({
        checklistString,
        sessionString,
        outputPath,
      })

      expect(result).toBeInstanceOf(Promise)
    })

    it('should handle checklist with empty questions array', async () => {
      const { generateFindingsReport } = await import('../utils/pdfGenerator')
      
      const mockChecklistData = {
        specialtyName: 'Test Specialty',
        inspection: 'INSP001',
        location: 'Test Location',
        startDate: '2024-01-15',
        questions: [],
      }

      const mockSessionData = {
        summary: {
          specialty: 'Test Specialty',
          finalized: false,
          lastUpdated: '2024-01-15T10:00:00Z',
          generalComments: 'No questions',
        },
        responses: {},
      }

      const checklistString = JSON.stringify(mockChecklistData)
      const sessionString = JSON.stringify(mockSessionData)
      const outputPath = '/tmp/test-report-empty.pdf'

      const result = generateFindingsReport({
        checklistString,
        sessionString,
        outputPath,
      })

      expect(result).toBeInstanceOf(Promise)
    })
  })
})
