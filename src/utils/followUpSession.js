import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true, verbose: true })

const evidenceItemSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    hashValue: { type: 'string' },
    immutable: { type: 'boolean' },
    sealedDate: { type: 'string' },
  },
  additionalProperties: false,
  required: ['name'],
}

const followUpSessionSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        specialty: { type: 'string' },
        finalized: { type: 'boolean' },
        lastUpdated: { type: 'string' },
        generalComments: { type: 'string' },
        locationId: { type: 'string' },
      },
      additionalProperties: false,
      required: ['specialty'],
    },
    responses: {
      type: 'object',
      patternProperties: {
        '^[A-Za-z0-9][A-Za-z0-9_:\\-\\.]*$': {
          type: 'object',
          properties: {
            findingId: { type: 'string' },
            percentComplete: { type: 'number', minimum: 0, maximum: 100 },
            effectivenessConfirmed: { type: 'boolean' },
            findingClosed: { type: 'boolean' },
            comments: { type: 'string' },
            closureVerificationMethod: { type: 'string' },
            followUpDate: { type: 'string' },
            followUpClosureDate: { type: 'string' },
            evidence: {
              type: 'array',
              items: evidenceItemSchema,
            },
          },
          additionalProperties: false,
          required: ['findingId'],
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
  required: ['summary'],
}

const validateFollowUpSession = ajv.compile(followUpSessionSchema)

export function parseFollowUpSession(contents) {
  try {
    const json = JSON.parse(contents)
    if (!validateFollowUpSession(json)) {
      const errors =
        validateFollowUpSession.errors
          ?.map((err) => `Invalid follow-up session data at ${err.instancePath}: ${err.message}`)
          .join('; ') || 'Unknown validation error'
      throw new Error(`Follow-up session validation failed: ${errors}`)
    }
    return json
  } catch (e) {
    console.log('Failed to load follow-up session:', e)
    throw e
  }
}

// Returns a map of all evidence file names referenced in the follow-up session
export function getFollowUpEvidenceLinks(sessionObj) {
  const evidenceLinks = {}

  JSON.parse(sessionObj, (key, value) => {
    if (key == 'evidence') {
      value.forEach((x) => {
        const linkName = x?.name
        if (typeof linkName != 'string' || linkName.length == 0) {
          return
        }
        if (!evidenceLinks[linkName]) {
          evidenceLinks[linkName] = { count: 1 }
        } else {
          evidenceLinks[linkName].count++
        }
      })
    }
    return value
  })

  return evidenceLinks
}
