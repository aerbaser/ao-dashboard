import type { PipelineState } from './types';

// Semantic color groups — 4 colors instead of 19
// See design-tokens.json: pipeline.state-*
export const SEMANTIC_COLORS = {
  early:      '#60A5FA', // blue — intake through planning
  active:     '#F5A623', // orange/amber — hands-on work
  completion: '#22C55E', // green — finishing & done
  problem:    '#EF4444', // red — blocked / failed / stuck
} as const;

export type SemanticGroup = keyof typeof SEMANTIC_COLORS;

export const STATE_GROUP: Record<PipelineState, SemanticGroup> = {
  INTAKE:         'early',
  CONTEXT:        'early',
  RESEARCH:       'early',
  DESIGN:         'early',
  PLANNING:       'early',
  SETUP:          'active',
  EXECUTION:      'active',
  AWAITING_OWNER: 'active',
  CI_PENDING:     'active',
  REVIEW_PENDING: 'completion',
  QUALITY_GATE:   'completion',
  FINALIZING:     'completion',
  DEPLOYING:      'completion',
  OBSERVING:      'completion',
  DONE:           'completion',
  BLOCKED:        'problem',
  FAILED:         'problem',
  WAITING_USER:   'problem',
  STUCK:          'problem',
};

export const STATE_COLORS: Record<PipelineState, string> = Object.fromEntries(
  (Object.keys(STATE_GROUP) as PipelineState[]).map((s) => [s, SEMANTIC_COLORS[STATE_GROUP[s]]]),
) as Record<PipelineState, string>;
