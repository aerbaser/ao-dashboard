import { describe, it, expect } from 'vitest'
import { PIPELINE_STATES } from '../../src/lib/types'
import { STATE_GROUP } from '../../src/lib/pipeline-colors'

/**
 * Semantic color matrix — every pipeline state must belong to exactly one
 * of the four semantic groups defined in design-tokens.json.
 */

const EXPECTED_GROUPS: Record<string, string[]> = {
  early: ['INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING'],
  active: ['SETUP', 'EXECUTION', 'AWAITING_OWNER', 'CI_PENDING'],
  completion: ['REVIEW_PENDING', 'QUALITY_GATE', 'FINALIZING', 'DEPLOYING', 'OBSERVING', 'DONE'],
  problem: ['BLOCKED', 'FAILED', 'WAITING_USER', 'STUCK'],
}

describe('Semantic color groups', () => {
  it('every pipeline state maps to a semantic group', () => {
    for (const state of PIPELINE_STATES) {
      expect(STATE_GROUP[state]).toBeDefined()
    }
  })

  it('uses exactly 4 groups: early, active, completion, problem', () => {
    const groups = new Set(Object.values(STATE_GROUP))
    expect([...groups].sort()).toEqual(['active', 'completion', 'early', 'problem'])
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

  it('all 19 states are covered (no orphans)', () => {
    const mappedStates = Object.keys(STATE_GROUP).sort()
    const allStates = [...PIPELINE_STATES].sort()
    expect(mappedStates).toEqual(allStates)
  })
})
