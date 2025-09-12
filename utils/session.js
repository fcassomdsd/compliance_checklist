import Ajv from 'ajv';
//import logger from './logger';

const ajv = new Ajv({ allErrors: true, verbose: true });

const sessionSchema = {
  type: "object",
  oneOf: [{
    properties: {
      summary: {
        type: "object",
        properties: {
          specialty: {
            type: "string"
          },
          location: {
            type: "string"
          },
          finalized: {
            type: "boolean"
          },
          lastUpdated: {
            type: "string"
          }
        }
      }
    },
    additionalProperties: false,
    required: ["specialty", "location"]
  }, {
     properties : {
        responses : {
           type : "object",
           patternProperties: {
             "^[0-9]+$": {
               type: "object",
               properties: {
                 id: {
                   type: "string"
                 },
                 compliance: {
                   type: "string",
                   enum: ["Not applicable", "Compliant", "Partial Compliance", "Non-compliant"]
                 },
                 comments: {
                   type: "string"
                 },
                 evidence: {
                   type: "array",
                   items: {
                     type: "string",
                   }
                 }
               },
               additionalProperties: false,
               required: ["id"]
             }
           },
           additionalProperties: false
        }
     }
     }
  ]
}

const validateSession = ajv.compile(sessionSchema);

const parseSession = (contents) => {
   
try {
    const json = JSON.parse(contents);
    if (!validateSession(json)) {
      const errors = validateSession.errors?.map(err => 
        `Invalid session data at ${err.instancePath}: ${err.message}`
      ).join('; ') || 'Unknown validation error';
      throw new Error(`Session validation failed: ${errors}`);
    }
    return json;
  } catch (e) {
    console.log(`Failed to load session:`, e);
    throw e;
  }   
}

export default parseSession;