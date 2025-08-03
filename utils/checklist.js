const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ajv = new Ajv();
const checklistSchema = {
  type: "object",
  properties: {
    specialty: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        anyOf : [ 
          {
            properties: {
              reference: { type: "string" },
              question: { type: "string" },
              verification: { type: "string" }
            },
            required: ["reference", "question", "verification"],
            additionalProperties : false
          },
          { 
            properties: {
              subtitle : { type: "string"}
            },
            additionalProperties : false
          }
        ]
      }
    }
  },
  required: ["specialty", "questions"],
  additionalProperties : false
};

function loadChecklist(filePath) {
  const data = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(data);
  const valid = ajv.validate(checklistSchema, json);
  if (!valid) {
    throw new Error("Checklist validation error: " + ajv.errorsText());
  }
  return json;
}

module.exports = { loadChecklist };