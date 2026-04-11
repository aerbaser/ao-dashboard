import type { PipelineState } from './types';

// Semantic color groups — 5 colors for autonomy v1
// See design-tokens.json: pipeline.state-*
export const SEMANTIC_COLORS = {
  early:        '#60A5FA', // blue — idea/approval/spec phase
  active:       '#F5A623', // orange/amber — hands-on build work
  completion:   '#22C55E', // green — done (proof-passed only)
  problem:      '#EF4444', // red — blocked / failed / stuck
  verification: '#818CF8', // indigo — post-merge, not yet proven
} as const;

export type SemanticGroup = keyof typeof SEMANTIC_COLORS;

export const STATE_GROUP: Record<PipelineState, SemanticGroup> = {
  // Autonomy v1 canonical states
  IDEA_PENDING_APPROVAL: 'early',
  APPROVED:              'early',
  IN_SPEC:               'early',
  IN_BUILD:              'active',
  PR_READY:              'active',
  MERGE_READY:           'active',
  MERGED_NOT_DEPLOYED:   'verification',
  DEPLOYED_NOT_VERIFIED: 'verification',
  LIVE_ACCEPTANCE:       'verification',
  DONE:                  'completion',
  // Legacy states
  INTAKE:         'early',
  CONTEXT:        'early',
  RESEARCH:       'early',
  DESIGN:         'early',
  PLANNING:       'early',
  SETUP:          'active',
  EXECUTION:      'active',
  AWAITING_OWNER: 'active',
  CI_PENDING:     'active',
  REVIEW_PENDING: 'active',
  QUALITY_GATE:   'active',
  FINALIZING:     'active',
  DEPLOYING:      'verification',
  OBSERVING:      'verification',
  // Side states
  BLOCKED:        'problem',
  FAILED:         'problem',
  WAITING_USER:   'problem',
  STUCK:          'problem',
};

export const STATE_COLORS: Record<PipelineState, string> = Object.fromEntries(
  (Object.keys(STATE_GROUP) as PipelineState[]).map((s) => [s, SEMANTIC_COLORS[STATE_GROUP[s]]]),
) as Record<PipelineState, string>;
