import { useEffect, useState, useCallback, useRef } from 'react';
import type { Task, TaskEvent, TaskDecision, TaskContract } from '../../lib/types';
import { getValidTransitions } from '../../lib/types';
import { fetchTaskEvents, fetchTaskDecisions, fetchTaskContract, transitionTask, addTaskEvent } from '../../lib/api';
import { EventTimeline } from './EventTimeline';
import { CommentThread } from './CommentThread';
import { CommentInput } from './CommentInput';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onTransition: () => void;
}

export function TaskDetail({ task, onClose, onTransition }: TaskDetailProps) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [decisions, setDecisions] = useState<TaskDecision[]>([]);
  const [contract, setContract] = useState<TaskContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitionState, setTransitionState] = useState<import('../../lib/types').PipelineState | ''>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showEventInput, setShowEventInput] = useState(false);
  const [eventText, setEventText] = useState('');
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const commentSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTaskEvents(task.id).catch(() => []),
      fetchTaskDecisions(task.id).catch(() => []),
      fetchTaskContract(task.id).catch(() => null),
    ]).then(([evts, decs, ctr]) => {
      setEvents(evts);
      setDecisions(decs);
      setContract(ctr);
      setLoading(false);
    });
  }, [task.id]);

  // Scroll to comments section when opening AWAITING_OWNER task
  useEffect(() => {
    if (!loading && task.state === 'AWAITING_OWNER' && commentSectionRef.current) {
      commentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, task.state]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTransition = useCallback(async () => {
    if (!transitionState) return;
    setActionError(null);
    try {
      const result = await transitionTask(task.id, transitionState as import('../../lib/types').PipelineState);
      if ('error' in result) {
        setActionError(result.message);
      } else {
        onTransition();
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setActionError(err.message || 'Transition failed');
    }
  }, [task.id, transitionState, onTransition]);

  const handleAddEvent = useCallback(async () => {
    const body = eventText.trim();
    if (!body || eventSubmitting) return;
    setActionError(null);
    setEventSubmitting(true);
    try {
      await addTaskEvent(task.id, 'NOTE', { actor: 'operator', body });
      const evts = await fetchTaskEvents(task.id);
      setEvents(evts);
      setEventText('');
      setShowEventInput(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setActionError(err.message || 'Failed to add event');
    } finally {
      setEventSubmitting(false);
    }
  }, [task.id, eventText, eventSubmitting]);

  // Subdirectories for artifacts
  const artifactDirs = ['issue-contracts', 'outputs', 'execution-bundles', 'review-findings'];

  const commentList: import('../../lib/types').CommentEvent[] = events
    .filter((e) => e.event_type === 'USER_COMMENT' || e['type'] === 'USER_COMMENT')
    .map((e) => {
      const payload = e['payload'] as { body?: string; actor?: string } | undefined;
      return {
        actor: e.actor || payload?.actor || 'unknown',
        body: (e['body'] as string) || payload?.body || '',
        timestamp: e.timestamp,
      };
    });

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-bg-elevated border-l border-border-subtle z-50 animate-slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-text-primary truncate">
              {task.title || 'Untitled'}
            </h2>
            <p className="font-mono text-xs text-text-tertiary mt-0.5">{task.id}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-sm text-text-secondary hover:bg-bg-hover transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-text-secondary text-sm">Loading...</div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Contract section */}
            {contract && (
              <section>
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Contract
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Outcome</span>
                    <span className="font-mono text-text-primary">{contract.outcome_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Delivery</span>
                    <span className="font-mono text-text-primary">{contract.delivery_mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Route</span>
                    <span className="font-mono text-text-primary">{contract.route}</span>
                  </div>
                  {contract.constraints.length > 0 && (
                    <div>
                      <span className="text-text-tertiary">Constraints</span>
                      <ul className="mt-1 space-y-0.5">
                        {contract.constraints.map((c, i) => (
                          <li key={i} className="font-mono text-xs text-text-secondary">• {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Event Timeline */}
            <section>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Event Timeline
              </h3>
              <EventTimeline events={events} />
            </section>

            {/* Comments */}
            <section ref={commentSectionRef}>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Comments
              </h3>
              <CommentThread comments={commentList} />
              {task.state === 'AWAITING_OWNER' && (
                <div className="mt-3">
                  <CommentInput taskId={task.id} onCommentAdded={() => {
                    fetchTaskEvents(task.id).catch(() => []).then(setEvents);
                  }} />
                </div>
              )}
            </section>

            {/* Decision Log */}
            {decisions.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Decision Log
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-tertiary text-left">
                        <th className="pb-1 pr-2">Agent</th>
                        <th className="pb-1 pr-2">Gate</th>
                        <th className="pb-1 pr-2">Result</th>
                        <th className="pb-1">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisions.map((d, i) => (
                        <tr key={d.decision_id || i} className="border-t border-border-subtle">
                          <td className="py-1 pr-2 font-mono text-text-primary">{d.resolved_by}</td>
                          <td className="py-1 pr-2 font-mono text-text-secondary">{d.gate_type}</td>
                          <td className="py-1 pr-2 font-mono text-text-secondary">{d.resolution_mode}</td>
                          <td className="py-1 font-mono text-text-tertiary">
                            {new Date(d.resolved_at).toLocaleTimeString('en-US', { hour12: false })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Sub-artifacts */}
            <section>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Artifacts
              </h3>
              <div className="space-y-1">
                {artifactDirs.map((dir) => (
                  <div
                    key={dir}
                    className="px-2 py-1.5 rounded-sm bg-bg-surface text-sm font-mono text-text-secondary"
                  >
                    {dir}/
                  </div>
                ))}
              </div>
            </section>

            {/* Action buttons */}
            <section>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Actions
              </h3>

              {actionError && (
                <div className="mb-2 p-2 rounded-md bg-red-subtle border border-red text-red text-xs font-mono">
                  {actionError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <select
                  value={transitionState}
                  onChange={(e) => setTransitionState(e.target.value as import('../../lib/types').PipelineState | '')}
                  disabled={!getValidTransitions(task.state).length}
                  className="flex-1 bg-bg-void border border-border-default rounded-sm px-2 py-1.5 text-sm font-mono text-text-primary focus:border-amber focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">Transition to...</option>
                  {getValidTransitions(task.state).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleTransition}
                  disabled={!transitionState}
                  className="px-3 py-1.5 rounded-sm bg-amber text-text-inverse font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                >
                  Go
                </button>
              </div>

              <div className="mt-2">
                <button
                  onClick={() => setShowEventInput((v) => !v)}
                  className="px-3 py-1.5 rounded-sm border border-border-subtle text-text-secondary text-sm hover:bg-bg-elevated transition-colors"
                >
                  {showEventInput ? 'Cancel' : 'Add Event'}
                </button>
                {showEventInput && (
                  <div className="flex gap-2 mt-2">
                    <textarea
                      className="flex-1 bg-bg-void border border-border-default rounded-sm p-2 text-sm text-text-primary placeholder:text-text-disabled resize-none focus:border-amber focus:outline-none disabled:opacity-50"
                      rows={2}
                      placeholder="Describe the event…"
                      value={eventText}
                      onChange={(e) => setEventText(e.target.value)}
                      disabled={eventSubmitting}
                    />
                    <button
                      onClick={handleAddEvent}
                      disabled={!eventText.trim() || eventSubmitting}
                      className="self-end px-3 py-1.5 rounded-sm bg-amber text-text-inverse font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                    >
                      {eventSubmitting ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
