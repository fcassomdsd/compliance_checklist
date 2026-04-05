import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, verbose: true })
addFormats(ajv)

const findingEntrySchema = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'string' },
    finding: {
      type: 'object',
      properties: {
        findingId: { type: 'string' },
        domain: { type: 'string' },
        providerId: { type: 'string' },
        locationId: { type: 'string' },
        locationName: { type: 'string' },
        itemId: { type: 'string' },
        requirementBreached: { type: 'string' },
        dateIssued: { type: 'string', format: 'date' },
        findingLevel: { type: 'string' },
        description: { type: 'string' },
        riskLevel: { type: 'string' },
        findingStatus: { type: 'string' },
        correctiveAction: {
          type: 'object',
          properties: {
            capId: { type: 'string' },
            proposedAction: { type: 'string' },
            responsibleEntity: { type: 'string' },
            dueDate: { type: 'string', format: 'date' },
            acceptanceStatus: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
      required: ['findingId', 'locationId'],
      additionalProperties: true,
    },
  },
  required: ['finding'],
  additionalProperties: true,
}

const findingsSchema = {
  type: 'array',
  items: findingEntrySchema,
}

const validateFindings = ajv.compile(findingsSchema)

export function parseFindings(contents) {
  try {
    const json = JSON.parse(contents)
    if (!validateFindings(json)) {
      const errors =
        validateFindings.errors
          ?.map((err) => `Invalid findings data at ${err.instancePath}: ${err.message}`)
          .join('; ') || 'Unknown validation error'
      throw new Error(`Findings validation failed: ${errors}`)
    }
    return json
  } catch (e) {
    console.log(`Failed to parse findings :`, e)
    throw e
  }
}
