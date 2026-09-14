// Shared domain rules for the Electron main process.
//
// domain-rules/nomenclatura.spec.json is vendored byte-for-byte from
// compliance_cmis (the canonical copy) and is shipped inside the app bundle
// (see electron-builder.config.js). Keep the follow-up vocabulary and the
// closure rule in the spec, not here.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const domainSpec = require('../../domain-rules/nomenclatura.spec.json')

export const SPEC_VERSION = domainSpec.version

export const FOLLOW_UP_TYPES = Object.freeze([...domainSpec.followUpTypes.canonical])
export const FOLLOW_UP_TYPE_ALIASES = Object.freeze({ ...domainSpec.followUpTypes.aliases })
export const DEFAULT_FOLLOW_UP_TYPE = domainSpec.followUpTypes.default
export const CLOSURE_FOLLOW_UP_TYPE = domainSpec.closureGate.requiredFollowUpType

export const SEVERITY_LEVELS = domainSpec.severity.levels.map((level) => ({ ...level }))

export const EVIDENCE_ROLES = Object.freeze([...domainSpec.evidenceRoles])

// Legacy workspaces stored "Progress Verification"; the platform vocabulary is
// "Progress Review". Unknown values fall back to the default.
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

// CAP Verification is only meaningful when the finding carries a corrective
// action, so the caller filters it back in.
export function allowedFollowUpTypes({ hasCorrectiveAction }) {
  if (hasCorrectiveAction) {
    return [...FOLLOW_UP_TYPES]
  }

  const restricted = new Set(domainSpec.followUpTypes.requiresCorrectiveAction || [])
  return FOLLOW_UP_TYPES.filter((type) => !restricted.has(type))
}
