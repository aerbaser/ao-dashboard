/**
 * Returns Tailwind CSS class for age badge color based on task state and age in minutes.
 * State-specific thresholds follow issue #139 spec.
 */
export function ageColor(state: string, ageMinutes: number | null): string {
  if (ageMinutes === null) return 'text-text-tertiary';

  const thresholds: Record<string, [number, number]> = {
    EXECUTION: [120, 480],
    SETUP: [120, 480],
    REVIEW_PENDING: [60, 180],
    CI_PENDING: [60, 180],
    AWAITING_OWNER: [60, 180],
    CONTEXT: [240, 720],
    RESEARCH: [240, 720],
    DESIGN: [240, 720],
    PLANNING: [240, 720],
  };

  const [amberThreshold, redThreshold] = thresholds[state] ?? [180, 480];

  if (ageMinutes >= redThreshold) return 'text-red';
  if (ageMinutes >= amberThreshold) return 'text-amber';
  return 'text-text-tertiary';
}
