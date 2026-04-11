/**
 * Returns Tailwind CSS class for age badge color based on task state and age in minutes.
 * State-specific thresholds follow issue #139 spec + autonomy v1 additions.
 */
export function ageColor(state: string, ageMinutes: number | null): string {
  if (ageMinutes === null) return 'text-text-tertiary';

  const thresholds: Record<string, [number, number]> = {
    // Legacy states
    EXECUTION: [120, 480],
    SETUP: [120, 480],
    REVIEW_PENDING: [60, 180],
    CI_PENDING: [60, 180],
    AWAITING_OWNER: [60, 180],
    CONTEXT: [240, 720],
    RESEARCH: [240, 720],
    DESIGN: [240, 720],
    PLANNING: [240, 720],
    // Autonomy v1 states
    IDEA_PENDING_APPROVAL: [480, 1440],
    APPROVED: [240, 720],
    IN_SPEC: [240, 720],
    IN_BUILD: [120, 480],
    PR_READY: [60, 180],
    MERGE_READY: [60, 180],
    MERGED_NOT_DEPLOYED: [60, 240],
    DEPLOYED_NOT_VERIFIED: [60, 240],
    LIVE_ACCEPTANCE: [120, 480],
  };

  const [amberThreshold, redThreshold] = thresholds[state] ?? [180, 480];

  if (ageMinutes >= redThreshold) return 'text-red';
  if (ageMinutes >= amberThreshold) return 'text-amber';
  return 'text-text-tertiary';
}
