import type { PipelineState } from './types';

export type AgeColor = 'green' | 'amber' | 'red' | 'neutral';

interface AgeThresholds {
  amber: number; // minutes
  red: number;   // minutes
}

const EXECUTION_THRESHOLDS: AgeThresholds = { amber: 120, red: 480 };
const REVIEW_THRESHOLDS: AgeThresholds = { amber: 60, red: 180 };
const CONTEXT_THRESHOLDS: AgeThresholds = { amber: 240, red: 720 };
const DEFAULT_THRESHOLDS: AgeThresholds = { amber: 180, red: 480 };

function getThresholds(state: PipelineState): AgeThresholds {
  switch (state) {
    case 'EXECUTION':
    case 'SETUP':
      return EXECUTION_THRESHOLDS;
    case 'REVIEW_PENDING':
    case 'CI_PENDING':
    case 'AWAITING_OWNER':
      return REVIEW_THRESHOLDS;
    case 'CONTEXT':
    case 'RESEARCH':
    case 'DESIGN':
    case 'PLANNING':
      return CONTEXT_THRESHOLDS;
    default:
      return DEFAULT_THRESHOLDS;
  }
}

/**
 * Returns the semantic age color for a task based on its state and age in minutes.
 * - 'neutral' when age is null (no data)
 * - 'green' when within normal range
 * - 'amber' when in warning range
 * - 'red' when critical
 */
export function getAgeColor(state: PipelineState, age: number | null): AgeColor {
  if (age === null) return 'neutral';
  const { amber, red } = getThresholds(state);
  if (age >= red) return 'red';
  if (age >= amber) return 'amber';
  return 'green';
}

/** Returns threshold info for a given state (for tooltips / display). */
export function getAgeThresholds(state: PipelineState): AgeThresholds {
  return getThresholds(state);
}
