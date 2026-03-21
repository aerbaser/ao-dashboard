import type { TaskEvent } from '../../lib/types';

interface EventTimelineProps {
  events: TaskEvent[];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function eventLabel(event: TaskEvent): string {
  if (event.event_type === 'STATE_CHANGED') {
    return `${event.from_state ?? '∅'} → ${event.to_state}`;
  }
  return event.event_type.replace(/_/g, ' ').toLowerCase();
}

export function EventTimeline({ events }: EventTimelineProps) {
  // Chronological: oldest first
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return <p className="text-text-tertiary text-sm">No events recorded.</p>;
  }

  return (
    <div className="space-y-0">
      {sorted.map((evt, i) => (
        <div
          key={evt.event_id || i}
          className="flex gap-3 py-2 border-b border-border-subtle last:border-b-0"
        >
          {/* Timeline dot + line */}
          <div className="flex flex-col items-center w-3 shrink-0">
            <div className="w-2 h-2 rounded-full bg-text-tertiary mt-1.5" />
            {i < sorted.length - 1 && (
              <div className="w-px flex-1 bg-border-subtle" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-text-secondary text-sm font-medium">
                {evt.actor}
              </span>
              <span className="text-text-primary text-sm">
                {eventLabel(evt)}
              </span>
            </div>
            <p className="font-mono text-xs text-text-tertiary mt-0.5">
              {formatTimestamp(evt.timestamp)}
            </p>
            {/* Extra data preview */}
            {evt.reason && (
              <p className="text-xs text-text-secondary mt-1">{evt.reason}</p>
            )}
            {typeof evt.summary === 'string' && (
              <p className="text-xs text-text-secondary mt-1">{evt.summary}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
