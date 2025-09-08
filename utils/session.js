const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const logger = require('./logger');

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

async function loadSession(filePath) {
   
try {
    logger.info("Loading session from " + filePath);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) {
       throw new Error("Could not get access to session file");
    }
    const content = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(content);
    if (!validateSession(json)) {
      const errors = validateSession.errors?.map(err => 
        `Invalid session data at ${err.instancePath}: ${err.message}`
      ).join('; ') || 'Unknown validation error';
      throw new Error(`Session validation failed: ${errors}`);
    }
    return json;
  } catch (e) {
    logger.error(`Failed to load session ${filePath}:`, e);
    throw e;
  }   
}

async function saveSession(filePath, data) {
  try {  
    sessionString = (typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    fs.writeFile(filePath, sessionString);
  } catch (error) {
    logger.error("Could not write to session file" + filePath, error);
    throw error;
  }
}

module.exports = {
  loadSession,
  saveSession
};