// checklist.test.js
import { describe, it, expect } from 'vitest'
import { parseChecklist } from '../utils/checklist'

describe('checklist.js', () => {
  it('parses a valid checklist object successfully', async () => {
    const validJson = JSON.stringify({
      specialtyName: 'VIG',
      specialtyCode: 'VIG',
      locationName: 'Location 1',
      inspection: '0224',
      startDate: '2024-01-01',
      questions: [
        {
          id: '1',
          code: 'VIG-0001',
          topic: 'Topic 1',
          reference: {
            normativa: {
              id: 'norm-1',
              reglamento: 'RAD 10',
              articulo: '10.1',
              texto: 'Sample text',
              ICAOref: 'A10 PI 1.1',
            },
            guidance: 'Manual 1.2',
          },
          question: 'Question 1',
          verification: 'Verification 1',
        },
      ],
    })
    const result = await parseChecklist(validJson)
    expect(result).toEqual(JSON.parse(validJson))
  })

  it('throws an error for an invalid checklist object', async () => {
    const invalidJson = JSON.stringify({
      specialtyName: 'VIG',
      questions: [
        {
          id: '1',
          topic: 'Topic 1',
          reference: { normativa: {}, guidance: 'GM text' },
          question: 'Question 1',
          // 'verification' is missing, which is a required field
        },
      ],
    })
    await expect(() => parseChecklist(invalidJson)).toThrow('Checklist validation failed')
  })

  it('throws an error for a non-JSON string', async () => {
    const invalidContent = 'This is not a JSON string'
    await expect(() => parseChecklist(invalidContent)).toThrow(SyntaxError)
  })

  it('parses a checklist with empty normativa object', async () => {
    const validJson = JSON.stringify({
      specialtyName: 'VIG',
      questions: [
        {
          id: '1',
          code: 'VIG-0001',
          topic: 'Topic 1',
          reference: { normativa: {}, guidance: 'GM only text' },
          question: 'Question 1',
          verification: 'Verification 1',
        },
      ],
    })
    const result = await parseChecklist(validJson)
    expect(result).toEqual(JSON.parse(validJson))
  })

  it('parses a checklist with providerName and new top-level fields', async () => {
    const validJson = JSON.stringify({
      specialtyName: 'VIG',
      specialtyCode: 'VIG',
      specialtyId: 'a01k0f67dskef2a475yzd8a5dxd',
      inspection: 'MDPP-2026-01',
      inspectionId: 'abc123',
      locationName: 'Aeropuerto Internacional Gregorio Luperon',
      locationId: 'a01k5qc0yxte2xts3r9btk77ft6',
      locationCode: 'MDPP',
      startDate: '2026-03-25',
      endDate: '2026-03-26',
      providerId: 'prov789',
      providerName: 'DTIC IDAC',
      questions: [
        {
          id: '1',
          code: 'VIG-0001',
          topic: 'Topic 1',
          reference: {
            normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Text', ICAOref: 'A10' },
            guidance: 'Manual 1.2',
          },
          question: 'Question 1',
          verification: 'Verification 1',
        },
      ],
    })
    const result = await parseChecklist(validJson)
    expect(result.providerName).toBe('DTIC IDAC')
    expect(result.providerId).toBe('prov789')
    expect(result.inspectionId).toBe('abc123')
    expect(result.endDate).toBe('2026-03-26')
    expect(result.specialtyCode).toBe('VIG')
    expect(result.specialtyId).toBe('a01k0f67dskef2a475yzd8a5dxd')
    expect(result.locationName).toBe('Aeropuerto Internacional Gregorio Luperon')
    expect(result.locationCode).toBe('MDPP')
  })

  it('parses a checklist question with priorFindingId', async () => {
    const validJson = JSON.stringify({
      specialtyName: 'VIG',
      questions: [
        {
          id: '1',
          code: 'VIG-0001',
          topic: 'Topic 1',
          reference: { normativa: {}, guidance: 'GM only text' },
          question: 'Question 1',
          verification: 'Verification 1',
          priorFindingId: 'MDPP001-VIG-01',
        },
      ],
    })

    const result = parseChecklist(validJson)
    expect(result.questions[0].priorFindingId).toBe('MDPP001-VIG-01')
  })

  it('parses a checklist question with riskLevel', async () => {
    const validJson = JSON.stringify({
      specialtyName: 'VIG',
      questions: [
        {
          id: '1',
          code: 'VIG-0001',
          topic: 'Topic 1',
          reference: { normativa: {}, guidance: 'GM only text' },
          question: 'Question 1',
          verification: 'Verification 1',
          riskLevel: 'High',
        },
      ],
    })

    const result = parseChecklist(validJson)
    expect(result.questions[0].riskLevel).toBe('High')
  })
})
