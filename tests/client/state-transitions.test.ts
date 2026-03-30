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
    for (const [from, targets] of Object.entries(STATE_TRANSITIONS)) {
      for (const to of targets) {
        expect(PIPELINE_STATES).toContain(to)
      }
    }
  })

  it('DONE has no outgoing transitions', () => {
    expect(getValidTransitions('DONE')).toEqual([])
  })

  it('EXECUTION can transition to REVIEW_PENDING, AWAITING_OWNER, BLOCKED', () => {
    expect(getValidTransitions('EXECUTION')).toEqual([
      'REVIEW_PENDING', 'AWAITING_OWNER', 'BLOCKED',
    ])
  })

  it('BLOCKED can only return to EXECUTION', () => {
    expect(getValidTransitions('BLOCKED')).toEqual(['EXECUTION'])
  })

  it('FAILED can only return to EXECUTION', () => {
    expect(getValidTransitions('FAILED')).toEqual(['EXECUTION'])
  })

  it('no state transitions to itself', () => {
    for (const [state, targets] of Object.entries(STATE_TRANSITIONS)) {
      expect(targets).not.toContain(state)
    }
  })

  it('INTAKE can go to CONTEXT or BLOCKED', () => {
    expect(getValidTransitions('INTAKE')).toEqual(['CONTEXT', 'BLOCKED'])
  })

  it('FINALIZING can go to DEPLOYING or DONE', () => {
    expect(getValidTransitions('FINALIZING')).toEqual(['DEPLOYING', 'DONE'])
  })

  it('each main-flow state has at least one forward transition (except DONE)', () => {
    const mainFlow: PipelineState[] = [
      'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING', 'SETUP',
      'EXECUTION', 'AWAITING_OWNER', 'REVIEW_PENDING', 'CI_PENDING',
      'QUALITY_GATE', 'FINALIZING', 'DEPLOYING', 'OBSERVING',
    ]
    for (const state of mainFlow) {
      expect(getValidTransitions(state).length).toBeGreaterThan(0)
    }
  })
})
