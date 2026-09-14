// Shared domain rules for the checklist renderer and Electron main process.
//
// domain-rules/nomenclatura.spec.json is vendored byte-for-byte from
// compliance_cmis (the canonical copy). The severity table, the follow-up
// vocabulary and the closure rule live there — do not reintroduce literals
// here. tests/domainRulesConformance.test.js pins every consumer to the spec.
import domainSpec from '../../domain-rules/nomenclatura.spec.json'

export const SEVERITY_LEVELS = domainSpec.severity.levels.map((level) => ({
  id: level.id,
  name: level.id,
  daysToSolution: level.daysToSolution,
}))

// The picker falls back to the least urgent level.
export const DEFAULT_SEVERITY_ID = SEVERITY_LEVELS[SEVERITY_LEVELS.length - 1].id

export const FOLLOW_UP_TYPES = Object.freeze([...domainSpec.followUpTypes.canonical])
export const FOLLOW_UP_TYPE_ALIASES = Object.freeze({ ...domainSpec.followUpTypes.aliases })
export const DEFAULT_FOLLOW_UP_TYPE = domainSpec.followUpTypes.default

export const CLOSURE_FOLLOW_UP_TYPE = domainSpec.closureGate.requiredFollowUpType

// Legacy workspaces stored "Progress Verification"; the platform vocabulary is
// "Progress Review". Unknown values fall back to the default, never silently
// pass through.
export function normalizeFollowUpType(value) {
  if (typeof value === 'string') {
    if (FOLLOW_UP_TYPE_ALIASES[value]) {
      return FOLLOW_UP_TYPE_ALIASES[value]
    }
    if (FOLLOW_UP_TYPES.includes(value)) {
      return value
    }
  }

  return DEFAULT_FOLLOW_UP_TYPE
}
