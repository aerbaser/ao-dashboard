import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STATES,
  STATE_TRANSITIONS,
  getValidTransitions,
  type PipelineState,
} from '../../src/lib/types'

describe('STATE_TRANSITIONS graph', () => {
  it('has an entry for every pipeline state', () => {
    for (const state of PIPELINE_STATES) {
      expect(STATE_TRANSITIONS).toHaveProperty(state)
    }
  })

  it('all transition targets are valid pipeline states', () => {
    for (const targets of Object.values(STATE_TRANSITIONS)) {
      for (const to of targets) {
        expect(PIPELINE_STATES).toContain(to)
      }
    }
  })

  it('DONE has no outgoing transitions', () => {
    expect(getValidTransitions('DONE')).toEqual([])
  })

  it('no state transitions to itself', () => {
    for (const [state, targets] of Object.entries(STATE_TRANSITIONS)) {
      expect(targets).not.toContain(state)
    }
  })

  // Autonomy v1 canonical flow tests
  it('IDEA_PENDING_APPROVAL can go to APPROVED or BLOCKED', () => {
    expect(getValidTransitions('IDEA_PENDING_APPROVAL')).toEqual(['APPROVED', 'BLOCKED'])
  })

  it('IN_BUILD can go to PR_READY, AWAITING_OWNER, or BLOCKED', () => {
    expect(getValidTransitions('IN_BUILD')).toEqual(['PR_READY', 'AWAITING_OWNER', 'BLOCKED'])
  })

  it('MERGED_NOT_DEPLOYED can go to DEPLOYED_NOT_VERIFIED or FAILED', () => {
    expect(getValidTransitions('MERGED_NOT_DEPLOYED')).toEqual(['DEPLOYED_NOT_VERIFIED', 'FAILED'])
  })

  it('LIVE_ACCEPTANCE can go to DONE or reopen to IN_SPEC', () => {
    expect(getValidTransitions('LIVE_ACCEPTANCE')).toEqual(['DONE', 'IN_SPEC'])
  })

  it('BLOCKED can return to EXECUTION or IN_BUILD', () => {
    expect(getValidTransitions('BLOCKED')).toEqual(['EXECUTION', 'IN_BUILD'])
  })

  // Legacy flow tests
  it('INTAKE can go to CONTEXT or BLOCKED', () => {
    expect(getValidTransitions('INTAKE')).toEqual(['CONTEXT', 'BLOCKED'])
  })

  it('EXECUTION can transition to REVIEW_PENDING, AWAITING_OWNER, BLOCKED', () => {
    expect(getValidTransitions('EXECUTION')).toEqual([
      'REVIEW_PENDING', 'AWAITING_OWNER', 'BLOCKED',
    ])
  })

  it('FINALIZING can bridge to autonomy via MERGED_NOT_DEPLOYED', () => {
    const targets = getValidTransitions('FINALIZING')
    expect(targets).toContain('MERGED_NOT_DEPLOYED')
  })

  it('each main-flow state has at least one forward transition (except DONE)', () => {
    const mainFlow: PipelineState[] = [
      'IDEA_PENDING_APPROVAL', 'APPROVED', 'IN_SPEC', 'IN_BUILD', 'PR_READY',
      'MERGE_READY', 'MERGED_NOT_DEPLOYED', 'DEPLOYED_NOT_VERIFIED', 'LIVE_ACCEPTANCE',
    ]
    for (const state of mainFlow) {
      expect(getValidTransitions(state).length).toBeGreaterThan(0)
    }
  })
})
