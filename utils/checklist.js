import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true, verbose: true })
const checklistSchema = {
  type: 'object',
  properties: {
    specialty: {
      type: 'string',
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
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
          topic: {
            type: 'string',
          },
          sequence: {
            type: 'string',
          },
        },
        required: ['id', 'topic', 'reference', 'question', 'verification'],
        additionalProperties: false,
      },
    },
  },
  required: ['specialty', 'questions'],
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
