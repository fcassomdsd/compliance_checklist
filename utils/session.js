const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ajv = new Ajv();
const sessionSchema = {
  "type": "object",
  "patternProperties": {
    "^[0-9]+$": {
      "type": "object",
      "properties": {
        "notapplicable": {
          "type": "boolean"
        },
        "compliance": {
          "type": "string",
          "enum": ["Compliant", "Partial Compliance", "Non-compliant"]
        },
        "comments": {
          "type": "string"
        },
        "evidence": {
          "type": "array",
          "items": {
            "type": "string",
          }
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}

function loadSession(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);
  const valid = ajv.validate(sessionSchema, json);
  if (!valid) {
    throw new Error("Session validation error: " + ajv.errorsText());
  }
  return json;
}

function saveSession(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { loadSession, saveSession };