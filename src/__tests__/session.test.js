// session.test.js
import { describe, it, expect } from 'vitest'
import { parseSession, getEvidenceLinks } from '../utils/session'

describe('session.js', () => {
  describe('parseSession', () => {
    it('parses a valid session object successfully', async () => {
      const validJson = JSON.stringify({
        summary: {
          specialty: 'SUR',
          finalized: false,
          lastUpdated: '2023-01-01T10:00:00Z',
        },
      })
      const result = await parseSession(validJson)
      expect(result).toEqual(JSON.parse(validJson))
    })

    it('parses a valid session object with responses successfully', async () => {
      const validJson = JSON.stringify({
        summary: {
          specialty: 'SUR',
          finalized: false,
          lastUpdated: '2023-01-01T10:00:00Z',
          locationId: 'MDPP',
        },
        responses: {
          1: {
            id: '1',
            compliance: 'Compliant',
            comments: 'Test comments',
            evidence: [{ name: 'file1.txt' }],
          },
        },
      })
      const result = await parseSession(validJson)
      expect(result).toEqual(JSON.parse(validJson))
    })

    it('parses a valid session object with item-code response keys successfully', async () => {
      const validJson = JSON.stringify({
        summary: {
          specialty: 'SUR',
          finalized: false,
          lastUpdated: '2023-01-01T10:00:00Z',
        },
        responses: {
          'SUR-0054': {
            id: 'q1',
            code: 'SUR-0054',
            compliance: 'Compliant',
            comments: 'Test comments',
            evidence: [{ name: 'file1.txt' }, { name: 'file2.txt' }],
          },
        },
      })
      const result = await parseSession(validJson)
      expect(result).toEqual(JSON.parse(validJson))
      expect(result.responses['SUR-0054'].code).toBe('SUR-0054')
    })

    it('parses a valid session object with audio recordings', async () => {
      const validJson = JSON.stringify({
        summary: {
          specialty: 'SUR',
          finalized: false,
          lastUpdated: '2023-01-01T10:00:00Z',
        },
        responses: {
          1: {
            id: '1',
            compliance: 'Compliant',
            comments: 'Test comments',
            audioComments: ['audio-1-comments-2023.webm'],
            evidence: [{ name: 'file1.txt' }],
          },
          2: {
            id: '2',
            compliance: 'Non-Compliant',
            nonConformityDetails: {
              description: 'Description of issue',
              findingLevel: 'Observation',
              riskLevel: 'High',
              audioNonConformity: ['audio-2-nonConformity-2023.webm'],
            },
            evidence: [{ name: 'file2.txt' }],
          },
        },
      })
      const result = await parseSession(validJson)
      expect(result).toEqual(JSON.parse(validJson))
      expect(result.responses['1'].audioComments).toEqual(['audio-1-comments-2023.webm'])
      expect(result.responses['2'].nonConformityDetails.findingLevel).toBe('Observation')
      expect(result.responses['2'].nonConformityDetails.audioNonConformity).toEqual(['audio-2-nonConformity-2023.webm'])
    })

    it('parses a valid session object with non-conformity details risk level', async () => {
      const validJson = JSON.stringify({
        summary: {
          specialty: 'SUR',
          finalized: false,
          lastUpdated: '2023-01-01T10:00:00Z',
        },
        responses: {
          'SUR-0001': {
            id: '1',
            code: 'SUR-0001',
            compliance: 'Non-Compliant',
            nonConformityDetails: {
              description: 'Issue description',
              findingLevel: 'Recommendation',
              riskLevel: 'Critical',
              pendingReview: true,
            },
          },
        },
      })

      const result = await parseSession(validJson)
      expect(result.responses['SUR-0001'].nonConformityDetails.riskLevel).toBe('Critical')
      expect(result.responses['SUR-0001'].nonConformityDetails.findingLevel).toBe('Recommendation')
      expect(result.responses['SUR-0001'].nonConformityDetails.pendingReview).toBe(true)
    })

    it('throws an error for a session object no summary', async () => {
      const invalidJson = JSON.stringify({
        responses: {
          1: {
            id: '1',
            compliance: 'Compliant',
            comments: 'Test comments',
            evidence: [{ name: 'file1.txt' }],
          },
        },
      })
      expect(() => parseSession(invalidJson)).toThrow('Session validation failed')
    })

    it('throws an error for an invalid session object', async () => {
      const invalidJson = JSON.stringify({
        summary: {
          finalized: false,
          lastUpdated: '2023-01-01T10:00:00Z',
        },
      })
      expect(() => parseSession(invalidJson)).toThrow('Session validation failed')
    })

    it('throws an error for an invalid response key', async () => {
      const invalidJson = JSON.stringify({
        summary: {
          specialty: 'SUR',
          finalized: false,
          lastUpdated: '2023-01-01T10:00:00Z',
        },
        responses: {
          'SUR 0054': {
            id: 'q1',
            compliance: 'Compliant',
          },
        },
      })
      expect(() => parseSession(invalidJson)).toThrow('Session validation failed')
    })

    it('throws an error for a non-JSON string', async () => {
      const invalidContent = 'This is not a JSON string'
      expect(() => parseSession(invalidContent)).toThrow(SyntaxError)
    })
  })

  describe('getEvidenceLinks', () => {
    const sampleJson = {
      1: {
        comments: 'several evidences',
        evidence: [{ name: 'onlyOne.txt' }, { name: 'IHaveThree.txt' }],
        audioComments: ['audio1.webm'],
      },
      2: {
        evidence: [{ name: 'IHaveThree.txt' }],
        comments: 'one evidence',
        audioComments: ['audio1.webm'],
      },
      3: {
        comments: 'no evidence',
      },
      5: {
        evidence: [],
        comments: 'empty evidence',
      },
      6: {
        evidence: [
          { name: 'Ex6.json' },
          { name: 'IHaveThree.txt' },
          { name: 'Ex4.json' },
          { name: 'Ex3.json' },
        ],
        nonConformityDetails: {
          audioNonConformity: ['audio2.webm'],
        },
        comments: 'a lot of evidence',
      },
    }

    it('correctly counts each file ocurrence including audio files', () => {
      const elinks = getEvidenceLinks(JSON.stringify(sampleJson))
      expect(elinks['onlyOne.txt'].count).toBe(1)
      expect(elinks['IHaveThree.txt'].count).toBe(3)
      expect(elinks['audio1.webm'].count).toBe(2)
      expect(elinks['audio2.webm'].count).toBe(1)
      expect(Object.keys(elinks).length).toBe(7)
    })
  })
})
