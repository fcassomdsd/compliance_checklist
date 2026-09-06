import { describe, it, expect } from 'vitest'
import { parseFindings } from '../utils/findings.js'

describe('findings.js', () => {
  it('parses a valid findings array', () => {
    const validJson = JSON.stringify([
      {
        schemaVersion: '1.0',
        findingId: 'MDPP001-SUR-01',
        locationId: 'a01-location',
        locationName: 'MDPP',
        domain: 'SUR',
        findingStatus: 'Open',
      },
    ])

    const result = parseFindings(validJson)
    expect(result[0].findingId).toBe('MDPP001-SUR-01')
  })

  it('throws for invalid findings payload', () => {
    const invalidJson = JSON.stringify([
      {
        schemaVersion: '1.0',
        findingId: 'MDPP001-SUR-01',
      },
    ])

    expect(() => parseFindings(invalidJson)).toThrow('Findings validation failed')
  })

  it('throws for non-json findings payload', () => {
    expect(() => parseFindings('not json')).toThrow(SyntaxError)
  })
})
