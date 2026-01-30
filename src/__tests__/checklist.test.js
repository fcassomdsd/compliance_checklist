// checklist.test.js
import { describe, it, expect } from 'vitest'
import { parseChecklist } from '../utils/checklist'

describe('checklist.js', () => {
  it('parses a valid checklist object successfully', async () => {
    const validJson = JSON.stringify({
      specialtyName: 'VIG',
      location: 'Location 1',
      inspection: '0224',
      startDate: '2024-01-01',
      questions: [
        {
          id: '1',
          topic: 'Topic 1',
          reference: 'Ref 1',
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
          reference: 'Ref 1',
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
})
