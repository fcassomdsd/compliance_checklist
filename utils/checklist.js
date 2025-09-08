const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const logger = require('./logger');

const ajv = new Ajv({ allErrors: true, verbose: true });
const checklistSchema = {
  type: "object",
  properties: {
    specialty: {
      type: "string"
    },
    questions: {
      type: "array",
      items: {
        type: "object",
          properties: {
            reference: {
              type: "string"
            },
            question: {
              type: "string"
            },
            verification: {
              type: "string"
            },
            id: {
              type: "string"
            },
            topic: {
              type: "string"
            },
            sequence: {
              type: "string"
            }
          },
          required: ["id", "topic", "reference", "question", "verification"],
          additionalProperties: false
      }
    }
  },
  required: ["specialty", "questions"],
  additionalProperties: false
};

const validateChecklist = ajv.compile(checklistSchema);

async function loadChecklist(filePath) {
   try {

    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) {
       throw new Error("Could not get access to checklist file");
    }
    const content = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(content);
    if (!validateChecklist(json)) {
      const errors = validateChecklist.errors?.map(err => 
        `Invalid session data at ${err.instancePath}: ${err.message}`
      ).join('; ') || 'Unknown validation error';
      throw new Error(`Checklist validation failed: ${errors}`);
    }
    return json;
  } catch (e) {
    logger.error(`Failed to load checklist ${filePath}:`, e);
    throw e;
  }   
}

module.exports = {
  loadChecklist
};