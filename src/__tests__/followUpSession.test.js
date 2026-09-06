// followUpSession.test.js
import { describe, it, expect } from 'vitest'
import { parseFollowUpSession, getFollowUpEvidenceLinks } from '../utils/followUpSession'

describe('followUpSession.js', () => {
  describe('parseFollowUpSession', () => {
    it('parses a minimal valid follow-up session', () => {
      const json = JSON.stringify({ summary: { specialty: 'SUR' } })
      const result = parseFollowUpSession(json)
      expect(result).toEqual(JSON.parse(json))
    })

    it('parses a full follow-up session with responses and evidence', () => {
      const session = {
        summary: {
          specialty: 'SUR',
          finalized: false,
          lastUpdated: '2024-01-01T10:00:00Z',
          generalComments: 'All good',
          locationId: 'LOC-001',
        },
        responses: {
          'FIND-001': {
            findingId: 'FIND-001',
            followUpType: 'Progress Verification',
            percentComplete: 80,
            effectivenessConfirmed: null,
            comments: 'In progress',
            evidence: [
              { name: 'file1.pdf', hashValue: 'abc123', immutable: true, sealedDate: '2024-01-01', evidenceRole: 'Progress Evidence' },
            ],
          },
        },
      }
      const result = parseFollowUpSession(JSON.stringify(session))
      expect(result).toEqual(session)
    })

    it('throws when summary is missing', () => {
      expect(() => parseFollowUpSession(JSON.stringify({ responses: {} }))).toThrow(
        'Follow-up session validation failed'
      )
    })

    it('throws when summary.specialty is missing', () => {
      expect(() =>
        parseFollowUpSession(JSON.stringify({ summary: { finalized: true } }))
      ).toThrow('Follow-up session validation failed')
    })

    it('throws when response item is missing findingId', () => {
      const session = {
        summary: { specialty: 'SUR' },
        responses: {
          'FIND-001': { followUpType: 'Progress Verification', percentComplete: 50 },
        },
      }
      expect(() => parseFollowUpSession(JSON.stringify(session))).toThrow(
        'Follow-up session validation failed'
      )
    })

    it('accepts evidence item when evidenceRole is omitted', () => {
      const session = {
        summary: { specialty: 'SUR' },
        responses: {
          'FIND-001': {
            findingId: 'FIND-001',
            followUpType: 'Progress Verification',
            evidence: [{ name: 'file.pdf', hashValue: 'abc' }],
          },
        },
      }
      expect(() => parseFollowUpSession(JSON.stringify(session))).not.toThrow()
    })

    it('accepts legacy response entries without followUpType', () => {
      const session = {
        summary: { specialty: 'SUR' },
        responses: {
          'FIND-001': {
            findingId: 'FIND-001',
            percentComplete: 25,
            comments: 'Legacy entry',
          },
        },
      }

      expect(() => parseFollowUpSession(JSON.stringify(session))).not.toThrow()
    })

    it('throws on invalid JSON', () => {
      expect(() => parseFollowUpSession('not json')).toThrow()
    })
  })

  describe('getFollowUpEvidenceLinks', () => {
    it('returns an empty object when no evidence is present', () => {
      const session = JSON.stringify({
        summary: { specialty: 'SUR' },
        responses: { 'F1': { findingId: 'F1' } },
      })
      expect(getFollowUpEvidenceLinks(session)).toEqual({})
    })

    it('returns counts for evidence items across responses', () => {
      const session = JSON.stringify({
        summary: { specialty: 'SUR' },
        responses: {
          'F1': { findingId: 'F1', followUpType: 'Progress Verification', evidence: [{ name: 'file1.pdf', evidenceRole: 'Progress Evidence' }, { name: 'file2.pdf', evidenceRole: 'Progress Evidence' }] },
          'F2': { findingId: 'F2', followUpType: 'Progress Verification', evidence: [{ name: 'file1.pdf', evidenceRole: 'Progress Evidence' }] },
        },
      })
      const links = getFollowUpEvidenceLinks(session)
      expect(links['file1.pdf']).toEqual({ count: 2 })
      expect(links['file2.pdf']).toEqual({ count: 1 })
    })

    it('ignores evidence items without a name string', () => {
      const session = JSON.stringify({
        summary: { specialty: 'SUR' },
        responses: {
          'F1': { findingId: 'F1', evidence: [{ hashValue: 'abc' }, { name: '' }] },
        },
      })
      expect(getFollowUpEvidenceLinks(session)).toEqual({})
    })
  })
})
