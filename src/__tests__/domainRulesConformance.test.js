// Conformance test for the shared, cross-repo domain-rule spec.
//
// domain-rules/nomenclatura.spec.json is vendored byte-for-byte from
// compliance_cmis (the canonical copy). This suite pins the renderer helpers,
// the Electron main-process helpers, the session schema and the bundled
// app.config.json to the published vectors, so the copies cannot drift again.
//
// Keep the assertions vector-driven: add cases to the spec, not to this file.

import { describe, it, expect } from 'vitest'

import domainSpec from '../../domain-rules/nomenclatura.spec.json'
import appConfig from '../../app.config.json'
import {
  CLOSURE_FOLLOW_UP_TYPE,
  DEFAULT_FOLLOW_UP_TYPE,
  DEFAULT_SEVERITY_ID,
  FOLLOW_UP_TYPES,
  FOLLOW_UP_TYPE_ALIASES,
  SEVERITY_LEVELS,
  normalizeFollowUpType as normalizeRendererFollowUpType,
} from '../utils/domainRules.js'
import {
  allowedFollowUpTypes as allowedMainFollowUpTypes,
  normalizeFollowUpType as normalizeMainFollowUpType,
} from '../../electron/utils/domainRules.mjs'

const specLevels = domainSpec.severity.levels.map((level) => [level.id, level.daysToSolution])

describe('domain-rule conformance', () => {
  it('vendors the canonical spec document', () => {
    expect(domainSpec.spec).toBe('nomenclatura-domain-rules')
    expect(domainSpec.version).toBeTruthy()
    expect(domainSpec.sourceOfTruth).toBe('compliance_cmis/domain-rules/nomenclatura.spec.json')
  })

  it('uses the spec severity table in the renderer', () => {
    expect(SEVERITY_LEVELS.map((level) => [level.id, level.daysToSolution])).toEqual(specLevels)
    expect(DEFAULT_SEVERITY_ID).toBe(domainSpec.severity.levels[domainSpec.severity.levels.length - 1].id)
  })

  it('keeps the bundled app.config.json severity fallback aligned with the spec', () => {
    const configLevels = appConfig.severity.levels.map((level) => [level.id, level.daysToSolution])
    expect(configLevels).toEqual(specLevels)
  })

  it('uses the canonical follow-up vocabulary in both processes', () => {
    expect([...FOLLOW_UP_TYPES]).toEqual(domainSpec.followUpTypes.canonical)
    expect(FOLLOW_UP_TYPE_ALIASES).toEqual(domainSpec.followUpTypes.aliases)
    expect(DEFAULT_FOLLOW_UP_TYPE).toBe(domainSpec.followUpTypes.default)
    expect(CLOSURE_FOLLOW_UP_TYPE).toBe(domainSpec.closureGate.requiredFollowUpType)
  })

  it('normalizes every follow-up type vector identically in the renderer and main process', () => {
    for (const vector of domainSpec.conformanceVectors.followUpTypeNormalization) {
      expect(normalizeRendererFollowUpType(vector.input), `renderer ${vector.input}`).toBe(vector.expected)
      expect(normalizeMainFollowUpType(vector.input), `main ${vector.input}`).toBe(vector.expected)
    }
  })

  it('maps the legacy Progress Verification alias without silently rewriting other values', () => {
    expect(normalizeRendererFollowUpType('Progress Verification')).toBe('Progress Review')
    expect(normalizeMainFollowUpType('Progress Verification')).toBe('Progress Review')
    expect(normalizeRendererFollowUpType('CAP Verification')).toBe('CAP Verification')
    expect(normalizeMainFollowUpType('Closure Verification')).toBe('Closure Verification')
  })

  it('only offers CAP Verification when the finding has a corrective action', () => {
    const restricted = new Set(domainSpec.followUpTypes.requiresCorrectiveAction)

    expect(allowedMainFollowUpTypes({ hasCorrectiveAction: true })).toEqual(domainSpec.followUpTypes.canonical)
    expect(allowedMainFollowUpTypes({ hasCorrectiveAction: false })).toEqual(
      domainSpec.followUpTypes.canonical.filter((type) => !restricted.has(type)),
    )
  })

  it('keeps every normalization target inside the canonical vocabulary', () => {
    for (const vector of domainSpec.conformanceVectors.followUpTypeNormalization) {
      expect(domainSpec.followUpTypes.canonical).toContain(vector.expected)
    }

    for (const aliasTarget of Object.values(domainSpec.followUpTypes.aliases)) {
      expect(domainSpec.followUpTypes.canonical).toContain(aliasTarget)
    }
  })
})
