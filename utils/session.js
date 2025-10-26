import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true, verbose: true })

const sessionSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        specialty: {
          type: 'string',
        },
        location: {
          type: 'string',
        },
        finalized: {
          type: 'boolean',
        },
        lastUpdated: {
          type: 'string',
        },
      },
      additionalProperties: false,
      required: ['specialty', 'location'],
    },
    responses: {
      type: 'object',
      patternProperties: {
        '^[0-9]+$': {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            compliance: {
              type: 'string',
              enum: ['Not applicable', 'Compliant', 'Non-compliant'],
            },
            comments: {
              type: 'string',
            },
            nonConformity: {
              type: 'string',
            },
            evidence: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          additionalProperties: false,
          required: ['id'],
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
  required: ['summary'],
}

const validateSession = ajv.compile(sessionSchema)

export function parseSession(contents) {
  try {
    const json = JSON.parse(contents)
    if (!validateSession(json)) {
      const errors =
        validateSession.errors
          ?.map((err) => `Invalid session data at ${err.instancePath}: ${err.message}`)
          .join('; ') || 'Unknown validation error'
      throw new Error(`Session validation failed: ${errors}`)
    }
    return json
  } catch (e) {
    console.log(`Failed to load session:`, e)
    throw e
  }
}

// returns an array of all files that appear in session, and the number of times they appear
export function getEvidenceLinks(sessionObj) {
  let evidenceLinks = {}

  JSON.parse(sessionObj, (key, value) => {
    if (key == 'evidence') {
      value.forEach((x) => {
        if (!evidenceLinks[x]) {
          evidenceLinks[x] = { count: 1 }
        } else {
          evidenceLinks[x].count++
        }
      })
    }
    return value
  })

  return evidenceLinks
}
