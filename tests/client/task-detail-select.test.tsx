import { describe, it, expect } from "vitest"
import { STATE_TRANSITIONS, PIPELINE_STATES } from "../../src/lib/types"

describe("STATE_TRANSITIONS", () => {
  it("covers all PIPELINE_STATES as keys", () => {
    for (const state of PIPELINE_STATES) {
      expect(STATE_TRANSITIONS).toHaveProperty(state)
    }
  })

  it("each value is an array of valid PipelineState", () => {
    for (const [_from, tos] of Object.entries(STATE_TRANSITIONS)) {
      for (const to of tos as string[]) {
        expect(PIPELINE_STATES).toContain(to)
      }
    }
  })

  it("DONE has no transitions", () => {
    expect(STATE_TRANSITIONS["DONE"]).toEqual([])
  })

  it("EXECUTION can go to REVIEW_PENDING, AWAITING_OWNER, BLOCKED", () => {
    expect(STATE_TRANSITIONS["EXECUTION"]).toContain("REVIEW_PENDING")
    expect(STATE_TRANSITIONS["EXECUTION"]).toContain("AWAITING_OWNER")
    expect(STATE_TRANSITIONS["EXECUTION"]).toContain("BLOCKED")
  })

  it("INTAKE cannot go directly to DONE", () => {
    expect(STATE_TRANSITIONS["INTAKE"]).not.toContain("DONE")
  })
})
