import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, verbose: true })
addFormats(ajv)

const checklistSchema = {
  type: 'object',
  properties: {
    specialtyName: {
      type: 'string',
    },
    specialtyCode: {
      type: 'string',
    },
    inspection: {
      type: 'string',
    },
    inspectionId: {
      type: 'string',
    },
    locationName: {
      type: 'string',
    },
    location: {
      type: 'string',
    },
    locationId: {
      type: 'string',
    },
    icaoCode: {
      type: 'string',
    },
    specialtyId: {
      type: 'string',
    },
    startDate: {
      type: 'string',
      format: 'date',
    },
    endDate: {
      type: 'string',
      format: 'date',
    },
    providerId: {
      type: 'string',
    },
    providerName: {
      type: 'string',
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reference: {
            type: 'object',
            properties: {
              normativa: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  reglamento: { type: 'string' },
                  articulo: { type: 'string' },
                  texto: { type: 'string' },
                  ICAOref: { type: ['string', 'null'] },
                },
                additionalProperties: false,
              },
              guidance: { type: 'string' },
            },
            additionalProperties: false,
          },
          question: {
            type: 'string',
          },
          verification: {
            type: 'string',
          },
          id: {
            type: 'string',
          },
          code: {
            type: 'string',
          },
          topic: {
            type: 'string',
          },
          sequence: {
            type: 'string',
          },
          priorFindingId: {
            type: 'string',
          },
          riskLevel: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
          },
        },
        required: ['id', 'topic', 'reference', 'question', 'verification'],
        additionalProperties: false,
      },
    },
  },
  required: ['specialtyName', 'questions'],
  additionalProperties: false,
}

const validateChecklist = ajv.compile(checklistSchema)

export function parseChecklist(contents) {
  try {
    const json = JSON.parse(contents)
    if (!validateChecklist(json)) {
      const errors =
        validateChecklist.errors
          ?.map((err) => `Invalid checklist data at ${err.instancePath}: ${err.message}`)
          .join('; ') || 'Unknown validation error'
      throw new Error(`Checklist validation failed: ${errors}`)
    }
    return json
  } catch (e) {
    console.log(`Failed to parse checklist :`, e)
    throw e
  }
}
