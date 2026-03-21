export function getUsageTone(progress: number) {
  if (progress > 0.85) return 'red'
  if (progress > 0.6) return 'amber'
  return 'green'
}
