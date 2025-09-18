// session.test.js
import { describe, it, expect } from 'vitest';
import { parseSession, countEvidence } from '../utils/session';

describe('session.js', () => {
  describe('parseSession', () => {
    it('parses a valid session object successfully', async () => {
      const validJson = JSON.stringify({
        summary: {
          specialty: "VIG",
          location: "Location A",
          finalized: false,
          lastUpdated: "2023-01-01T10:00:00Z"
        }
      });
      const result = await parseSession(validJson);
      expect(result).toEqual(JSON.parse(validJson));
    });

    it('parses a valid session object with responses successfully', async () => {
      const validJson = JSON.stringify({
        summary: {
          specialty: "VIG",
          location: "Location A",
          finalized: false,
          lastUpdated: "2023-01-01T10:00:00Z"
        },
        responses: {
          "1": {
            id: "1",
            compliance: "Compliant",
            comments: "Test comments",
            evidence: ["file1.txt"]
          }
        }
      });
      const result = await parseSession(validJson);
      expect(result).toEqual(JSON.parse(validJson));
    });

    it('throws an error for a session object no summary', async () => {
      const invalidJson = JSON.stringify({
        responses: {
          "1": {
            id: "1",
            compliance: "Compliant",
            comments: "Test comments",
            evidence: ["file1.txt"]
          }
        }
      });
      expect(() => parseSession(invalidJson)).toThrow('Session validation failed');
    });

    it('throws an error for an invalid session object', async () => {
      const invalidJson = JSON.stringify({
        summary: {
          specialty: "VIG",
          finalized: false,
          lastUpdated: "2023-01-01T10:00:00Z"
        }
      });
      expect(() => parseSession(invalidJson)).toThrow('Session validation failed');
    });

    it('throws an error for a non-JSON string', async () => {
      const invalidContent = 'This is not a JSON string';
      expect(() => parseSession(invalidContent)).toThrow(SyntaxError);
    });
  });

  describe('countEvidence', () => {
    const sampleJson = {
      "1": {
        "comments": "several evidences",
        "evidence": ["onlyOne.txt","IHaveThree.txt"]
      },
      "2": {
        "evidence": ["IHaveThree.txt"],
        "comments": "one evidence"
      },
      "3": {
        "comments": "no evidence"
      },
      "5": {
        "evidence": [],
        "comments": "empty evidence"
      },
      "6": {
        "evidence": ["Ex6.json","IHaveThree.txt", "Ex4.json","Ex3.json"],
        "comments": "a lot of evidence"
      }
    }
      
    
    it('finds count for only one', () => {

      const count = countEvidence(sampleJson, 'onlyOne.txt');
      expect(count).toBe(1);
    });

    it('finds count for more than one', () => {

      const count = countEvidence(sampleJson, 'IHaveThree.txt');
      expect(count).toBe(3);
    });

    it('finds count for none', () => {

      const count = countEvidence(sampleJson, 'IDontHaveAny.txt');
      expect(count).toBe(0);
    });

  });

 });
