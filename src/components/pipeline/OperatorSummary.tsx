import { useState } from 'react';
import type { Task, TaskContract } from '../../lib/types';

interface OperatorSummaryProps {
  task: Task;
  contract: TaskContract | null;
}

const TRUNCATE_LEN = 120;

function SourceBadge({ task }: { task: Task }) {
  if (task.source_type === 'github' && task.source_ref) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-bg-elevated text-text-secondary text-xs font-mono">
        <span aria-hidden>GH</span>
        {task.source_ref.repo}#{task.source_ref.issue_number}
      </span>
    );
  }
  if (task.source_type === 'github') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-bg-elevated text-text-secondary text-xs font-mono">
        GitHub issue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-bg-elevated text-text-secondary text-xs font-mono">
      Ledger task
    </span>
  );
}

function TruncatedText({ text, testId }: { text: string; testId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > TRUNCATE_LEN;

  return (
    <span data-testid={testId}>
      <span className="text-sm text-text-primary">
        {expanded || !needsTruncation ? text : text.slice(0, TRUNCATE_LEN) + '...'}
      </span>
      {needsTruncation && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-xs text-amber hover:underline"
          data-testid={testId ? `${testId}-toggle` : undefined}
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </span>
  );
}

export function OperatorSummary({ task, contract }: OperatorSummaryProps) {
  const goal = task.goal
    || (contract?.success_definition && contract.success_definition.length > 0
      ? contract.success_definition[0]
      : null)
    || contract?.raw_request
    || null;

  const nextAction = task.next_action || null;

  return (
    <section data-testid="operator-summary">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
        Summary
      </h3>
      <div className="space-y-2">
        {/* Source / Provenance */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-text-tertiary w-16 shrink-0 pt-0.5">Source</span>
          <SourceBadge task={task} />
        </div>

        {/* Goal / Outcome */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-text-tertiary w-16 shrink-0 pt-0.5">Goal</span>
          {goal ? (
            <TruncatedText text={goal} testId="goal-text" />
          ) : (
            <span className="text-sm text-text-disabled italic" data-testid="goal-fallback">Not specified</span>
          )}
        </div>

        {/* Next Action */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-text-tertiary w-16 shrink-0 pt-0.5">Next</span>
          {nextAction ? (
            <TruncatedText text={nextAction} testId="next-action-text" />
          ) : (
            <span className="text-sm text-text-disabled italic" data-testid="next-action-fallback">No next action recorded</span>
          )}
        </div>

        {/* Owner */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-text-tertiary w-16 shrink-0 pt-0.5">Owner</span>
          <span className="text-sm font-mono text-text-primary">{task.owner || 'Unassigned'}</span>
        </div>
      </div>
    </section>
  );
}
