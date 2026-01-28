import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create mock PDF document with chainable methods
const createMockDoc = () => ({
  pipe: vi.fn(function () {
    return this
  }),
  fontSize: vi.fn(function () {
    return this
  }),
  text: vi.fn(function () {
    return this
  }),
  moveDown: vi.fn(function () {
    return this
  }),
  moveUp: vi.fn(function () {
    return this
  }),
  font: vi.fn(function () {
    return this
  }),
  moveTo: vi.fn(function () {
    return this
  }),
  lineTo: vi.fn(function () {
    return this
  }),
  stroke: vi.fn(function () {
    return this
  }),
  addPage: vi.fn(function () {
    return this
  }),
  heightOfString: vi.fn(() => 20),
  end: vi.fn(),
  page: { width: 595, height: 842 },
  y: 100,
  table: vi.fn(function () {
    return {
      row: vi.fn(function () {
        return this
      }),
    }
  }),
  bufferedPageRange: vi.fn(() => ({ start: 0, count: 1 })),
  switchToPage: vi.fn(function () {
    return this
  }),
  save: vi.fn(function () {
    return this
  }),
  restore: vi.fn(function () {
    return this
  }),
  image: vi.fn(function () {
    return this
  }),
})

const mockDoc = createMockDoc()

// Create mock stream
const mockStream = {
  on: vi.fn((event, handler) => {
    if (event === 'finish') setTimeout(handler, 10)
    if (event === 'error') {
    } // ignore error for now
    return mockStream
  }),
  write: vi.fn(),
}

// Mock pdfkit and fs
vi.mock('pdfkit', () => ({
  default: vi.fn(() => mockDoc),
}))

vi.mock('fs', () => ({
  default: {
    createWriteStream: vi.fn(() => mockStream),
  },
}))

// Import after mocks are set up
import { generateFindingsReport } from '../src/utils/pdfGenerator.js'

describe('PDF Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock object state
    mockDoc.y = 100
    mockDoc.page = { width: 595, height: 842 }
  })

  it('generates PDF with basic checklist data', async () => {
    const checklist = {
      inspection: '1125',
      location: 'Aeropuerto Internacional',
      startDate: '2025-01-26',
      specialtyName: 'Sistemas de Vigilancia',
      questions: [
        {
          id: 1,
          topic: 'Security Systems',
          reference: 'GM 10.11',
          question: 'Is security in place?',
        },
      ],
    }

    const session = {
      summary: { generalComments: 'This is a general comment.'},        
      responses: {
        1: {
          compliance: 'Non-compliant',
          nonConformity: 'No security measures found',
        },
      },
    }

    const checklistString = JSON.stringify(checklist)
    const sessionString = JSON.stringify(session)

    const result = await generateFindingsReport({
      checklistString,
      sessionString,
      specialty: 'Sistemas de Vigilancia',
      outputPath: '/path/to/report.pdf',
    })

    expect(result).toBe('/path/to/report.pdf')
  })

  it('generates PDF with multiple non-compliant findings', async () => {
    const checklist = {
      inspection: '1125',
      location: 'Airport Terminal',
      startDate: '2025-01-26',
      specialtyName: 'Data Processing',
      questions: [
        {
          id: 1,
          topic: 'Data Processing',
          reference: 'RAD 10.11',
          question: 'Are procedures documented?',
        },
        {
          id: 2,
          topic: 'Data Processing',
          reference: 'Doc 4444',
          question: 'Is system reliability monitored?',
        },
        {
          id: 3,
          topic: 'Surveillance',
          reference: 'GM 8.1.1',
          question: 'Is surveillance reliable?',
        },
      ],
    }

    const session = {
      summary: { generalComments: 'This is a general comment.'},        
      responses: {
        1: { compliance: 'Non-compliant', nonConformity: 'No documentation' },
        2: { compliance: 'Non-compliant', nonConformity: 'No monitoring' },
        3: { compliance: 'Compliant', comments: 'Good system' },
      },
    }

    const result = await generateFindingsReport({
      checklistString: JSON.stringify(checklist),
      sessionString: JSON.stringify(session),
      specialty: 'Vigilancia',
      outputPath: '/path/to/report.pdf',
    })

    expect(result).toBe('/path/to/report.pdf')
  })

  it('handles checklist with no non-compliant findings', async () => {
    const checklist = {
      inspection: '1125',
      location: 'Airport',
      startDate: '2025-01-26',
      specialtyName: 'Security',
      questions: [
        {
          id: 1,
          topic: 'Security',
          reference: 'REF1',
          question: 'Is security in place?',
        },
      ],
    }

    const session = {
      summary: { generalComments: 'This is a general comment.'},        
      responses: {
        1: { compliance: 'Compliant', comments: 'All good' },
      },
    }

    const result = await generateFindingsReport({
      checklistString: JSON.stringify(checklist),
      sessionString: JSON.stringify(session),
      specialty: 'Security',
      outputPath: '/path/to/report.pdf',
    })

    expect(result).toBe('/path/to/report.pdf')
  })

  it('handles missing optional fields in checklist', async () => {
    const checklist = {
      inspection: '1125',
      location: 'Test Location',
      startDate: '2025-01-26',
      specialtyName: 'Test Specialty',
      questions: [
        {
          topic: 'Topic',
          reference: 'REF',
          question: 'Question?',
        },
      ],
    }

    const session = {
      summary: { generalComments: 'This is a general comment.'},        
      responses: {
        1: { compliance: 'Non-compliant', nonConformity: 'Issue found' },
      },
    }

    const result = await generateFindingsReport({
      checklistString: JSON.stringify(checklist),
      sessionString: JSON.stringify(session),
      specialty: 'Specialty',
      outputPath: '/path/to/report.pdf',
    })

    expect(result).toBe('/path/to/report.pdf')
  })

  it('handles empty session responses', async () => {
    const checklist = {
      inspection: '1125',
      location: 'Airport',
      startDate: '2025-01-26',
      specialtyName: 'Security',
      questions: [
        {
          topic: 'Security',
          reference: 'REF1',
          question: 'Question?',
        },
      ],
    }

    const session = {
      summary: { generalComments: 'This is a general comment.'},        
      responses: {},
    }

    const result = await generateFindingsReport({
      checklistString: JSON.stringify(checklist),
      sessionString: JSON.stringify(session),
      specialty: 'Security',
      outputPath: '/path/to/report.pdf',
    })

    expect(result).toBe('/path/to/report.pdf')
  })

  it('throws error when checklist string is invalid JSON', async () => {
    await expect(
      generateFindingsReport({
        checklistString: 'invalid json',
        sessionString: '{}',
        specialty: 'Test',
        outputPath: '/path/to/report.pdf',
      })
    ).rejects.toThrow()
  })

  it('throws error when session string is invalid JSON', async () => {
    const checklist = {
      inspection: '1125',
      questions: [],
    }

    await expect(
      generateFindingsReport({
        checklistString: JSON.stringify(checklist),
        sessionString: 'invalid json',
        specialty: 'Test',
        outputPath: '/path/to/report.pdf',
      })
    ).rejects.toThrow()
  })

  it('handles findings with long text gracefully', async () => {
    const longText = 'A'.repeat(500)
    const checklist = {
      inspection: '1125',
      location: 'Airport',
      startDate: '2025-01-26',
      specialtyName: 'Test',
      questions: [
        {
          topic: 'Data',
          reference: 'REF1',
          question: longText,
        },
      ],
    }

    const session = {
      summary: { generalComments: 'This is a general comment.'},        
      responses: {
        1: { compliance: 'Non-compliant', nonConformity: longText },
      },
    }

    const result = await generateFindingsReport({
      checklistString: JSON.stringify(checklist),
      sessionString: JSON.stringify(session),
      specialty: 'Test',
      outputPath: '/path/to/report.pdf',
    })

    expect(result).toBe('/path/to/report.pdf')
  })
})
