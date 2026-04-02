import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STATES,
  MAIN_FLOW_STATES,
  LEGACY_FLOW_STATES,
  TERMINAL_STATES,
  ACTIVE_STATES,
  VERIFICATION_STATES,
  ERROR_STATES,
  type PipelineState,
} from '../../src/lib/types'
import { STATE_GROUP, SEMANTIC_COLORS } from '../../src/lib/pipeline-colors'
import { ageColor } from '../../src/lib/age-color-css'

describe('Autonomy v1 — state definitions', () => {
  const CANONICAL_STATES: PipelineState[] = [
    'IDEA_PENDING_APPROVAL', 'APPROVED', 'IN_SPEC', 'IN_BUILD', 'PR_READY',
    'MERGE_READY', 'MERGED_NOT_DEPLOYED', 'DEPLOYED_NOT_VERIFIED',
    'LIVE_ACCEPTANCE', 'DONE',
  ]

  it('all 10 canonical autonomy states exist in PIPELINE_STATES', () => {
    for (const s of CANONICAL_STATES) {
      expect(PIPELINE_STATES).toContain(s)
    }
  })

  it('MAIN_FLOW_STATES contains exactly the canonical states', () => {
    expect(MAIN_FLOW_STATES).toEqual(CANONICAL_STATES)
  })

  it('legacy states are preserved in LEGACY_FLOW_STATES', () => {
    const expected = [
      'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING', 'SETUP',
      'EXECUTION', 'AWAITING_OWNER', 'REVIEW_PENDING', 'CI_PENDING', 'QUALITY_GATE',
      'FINALIZING', 'DEPLOYING', 'OBSERVING',
    ]
    expect(LEGACY_FLOW_STATES).toEqual(expected)
  })

  it('VERIFICATION_STATES are non-terminal post-merge states', () => {
    expect(VERIFICATION_STATES).toEqual([
      'MERGED_NOT_DEPLOYED', 'DEPLOYED_NOT_VERIFIED', 'LIVE_ACCEPTANCE',
    ])
  })

  it('verification states are NOT in TERMINAL_STATES', () => {
    for (const s of VERIFICATION_STATES) {
      expect(TERMINAL_STATES).not.toContain(s)
    }
  })

  it('verification states ARE in ACTIVE_STATES', () => {
    for (const s of VERIFICATION_STATES) {
      expect(ACTIVE_STATES).toContain(s)
    }
  })

  it('DONE is terminal', () => {
    expect(TERMINAL_STATES).toContain('DONE')
  })

  it('DONE is the only completion state that is terminal', () => {
    const completionStates = Object.entries(STATE_GROUP)
      .filter(([, g]) => g === 'completion')
      .map(([s]) => s)
    for (const s of completionStates) {
      if (s === 'DONE') {
        expect(TERMINAL_STATES).toContain(s)
      }
    }
  })
})

describe('Autonomy v1 — verification color group', () => {
  it('has indigo color for verification group', () => {
    expect(SEMANTIC_COLORS.verification).toBe('#818CF8')
  })

  it('MERGED_NOT_DEPLOYED maps to verification', () => {
    expect(STATE_GROUP.MERGED_NOT_DEPLOYED).toBe('verification')
  })

  it('DEPLOYED_NOT_VERIFIED maps to verification', () => {
    expect(STATE_GROUP.DEPLOYED_NOT_VERIFIED).toBe('verification')
  })

  it('LIVE_ACCEPTANCE maps to verification', () => {
    expect(STATE_GROUP.LIVE_ACCEPTANCE).toBe('verification')
  })
})

describe('Autonomy v1 — age color thresholds for new states', () => {
  it('IDEA_PENDING_APPROVAL has long thresholds (patient)', () => {
    expect(ageColor('IDEA_PENDING_APPROVAL', 400)).toBe('text-text-tertiary')
    expect(ageColor('IDEA_PENDING_APPROVAL', 500)).toBe('text-amber')
    expect(ageColor('IDEA_PENDING_APPROVAL', 1500)).toBe('text-red')
  })

  it('IN_BUILD has active thresholds', () => {
    expect(ageColor('IN_BUILD', 100)).toBe('text-text-tertiary')
    expect(ageColor('IN_BUILD', 130)).toBe('text-amber')
    expect(ageColor('IN_BUILD', 500)).toBe('text-red')
  })

  it('MERGED_NOT_DEPLOYED has tight thresholds', () => {
    expect(ageColor('MERGED_NOT_DEPLOYED', 50)).toBe('text-text-tertiary')
    expect(ageColor('MERGED_NOT_DEPLOYED', 70)).toBe('text-amber')
    expect(ageColor('MERGED_NOT_DEPLOYED', 250)).toBe('text-red')
  })
})

describe('Autonomy v1 — legacy backward compatibility', () => {
  it('legacy states still exist in PIPELINE_STATES', () => {
    const legacy = [
      'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING', 'SETUP',
      'EXECUTION', 'AWAITING_OWNER', 'REVIEW_PENDING', 'CI_PENDING',
      'QUALITY_GATE', 'FINALIZING', 'DEPLOYING', 'OBSERVING',
    ]
    for (const s of legacy) {
      expect(PIPELINE_STATES).toContain(s)
    }
  })

  it('legacy states have color group mappings', () => {
    const legacy = [
      'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING', 'SETUP',
      'EXECUTION', 'AWAITING_OWNER', 'REVIEW_PENDING', 'CI_PENDING',
      'QUALITY_GATE', 'FINALIZING', 'DEPLOYING', 'OBSERVING',
    ]
    for (const s of legacy) {
      expect(STATE_GROUP[s as PipelineState]).toBeDefined()
    }
  })

  it('ERROR_STATES are unchanged', () => {
    expect(ERROR_STATES).toEqual(['BLOCKED', 'FAILED', 'STUCK'])
  })
})
