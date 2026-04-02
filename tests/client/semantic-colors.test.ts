import { describe, it, expect } from 'vitest'
import { PIPELINE_STATES } from '../../src/lib/types'
import { STATE_GROUP } from '../../src/lib/pipeline-colors'

/**
 * Semantic color matrix — every pipeline state must belong to exactly one
 * of the five semantic groups (early, active, completion, problem, verification).
 */

const EXPECTED_GROUPS: Record<string, string[]> = {
  early: [
    'IDEA_PENDING_APPROVAL', 'APPROVED', 'IN_SPEC',
    'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING',
  ],
  active: [
    'IN_BUILD', 'PR_READY', 'MERGE_READY',
    'SETUP', 'EXECUTION', 'AWAITING_OWNER', 'CI_PENDING',
    'REVIEW_PENDING', 'QUALITY_GATE', 'FINALIZING',
  ],
  verification: [
    'MERGED_NOT_DEPLOYED', 'DEPLOYED_NOT_VERIFIED', 'LIVE_ACCEPTANCE',
    'DEPLOYING', 'OBSERVING',
  ],
  completion: ['DONE'],
  problem: ['BLOCKED', 'FAILED', 'WAITING_USER', 'STUCK'],
}

describe('Semantic color groups', () => {
  it('every pipeline state maps to a semantic group', () => {
    for (const state of PIPELINE_STATES) {
      expect(STATE_GROUP[state]).toBeDefined()
    }
  })

  it('uses exactly 5 groups: early, active, completion, problem, verification', () => {
    const groups = new Set(Object.values(STATE_GROUP))
    expect([...groups].sort()).toEqual(['active', 'completion', 'early', 'problem', 'verification'])
  })

  it.each(Object.entries(EXPECTED_GROUPS))('%s group contains expected states', (group, states) => {
    for (const state of states) {
      expect(STATE_GROUP[state as keyof typeof STATE_GROUP]).toBe(group)
    }
  })

  it('AWAITING_OWNER is in the active (amber/orange) group', () => {
    expect(STATE_GROUP.AWAITING_OWNER).toBe('active')
  })

  it('BLOCKED, FAILED, STUCK are in the problem (red) group', () => {
    expect(STATE_GROUP.BLOCKED).toBe('problem')
    expect(STATE_GROUP.FAILED).toBe('problem')
    expect(STATE_GROUP.STUCK).toBe('problem')
  })

  it('DONE is in the completion (green) group', () => {
    expect(STATE_GROUP.DONE).toBe('completion')
  })

  it('post-merge states are in the verification (indigo) group', () => {
    expect(STATE_GROUP.MERGED_NOT_DEPLOYED).toBe('verification')
    expect(STATE_GROUP.DEPLOYED_NOT_VERIFIED).toBe('verification')
    expect(STATE_GROUP.LIVE_ACCEPTANCE).toBe('verification')
  })

  it('all pipeline states are covered (no orphans)', () => {
    const mappedStates = Object.keys(STATE_GROUP).sort()
    const allStates = [...PIPELINE_STATES].sort()
    expect(mappedStates).toEqual(allStates)
  })
})
