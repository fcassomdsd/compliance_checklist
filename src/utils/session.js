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
        finalized: {
          type: 'boolean',
        },
        lastUpdated: {
          type: 'string',
        },
        generalComments: {
          type: 'string',
        },
        locationId: {
          type: 'string',
        },
      },
      additionalProperties: false,
      required: ['specialty'],
    },
    responses: {
      type: 'object',
      patternProperties: {
        '^[A-Za-z0-9][A-Za-z0-9_-]*$': {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            code: {
              type: 'string',
            },
            compliance: {
              type: 'string',
              enum: ['Not applicable', 'Compliant', 'Non-Compliant'],
            },
            comments: {
              type: 'string',
            },
            nonConformityDetails: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                },
                findingLevel: {
                  type: 'string',
                  enum: ['Non-Compliance', 'Observation', 'Recommendation'],
                },
                riskLevel: {
                  type: 'string',
                  enum: ['Low', 'Medium', 'High', 'Critical'],
                },
                audioNonConformity: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
              },
              additionalProperties: true,
            },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  hashValue: { type: 'string' },
                  immutable: { type: 'boolean' },
                  sealedDate: { type: 'string' },
                },
                additionalProperties: false,
                required: ['name'],
              },
            },
            audioComments: {
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
    if (key == 'evidence' || key == 'audioComments' || key == 'audioNonConformity') {
      value.forEach((x) => {
        const linkName = key == 'evidence' ? x?.name : x

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
