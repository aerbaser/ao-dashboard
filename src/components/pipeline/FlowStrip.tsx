const AGENT_EMOJI: Record<string, string> = {
  'sokrat':            '🦉',
  'archimedes':        '⚙️',
  'platon':            '🏛️',
  'leo':               '🎨',
  'aristotle':         '📚',
  'herodotus':         '📜',
  'hephaestus':        '⚒️',
  'brainstorm-claude': '🧠',
  'brainstorm-codex':  '💡',
  'code-review-gate':  '🛡️',
  'unknown':           '👤',
};

const AGENT_ROLES: Record<string, string> = {
  'sokrat':            'Orchestrator',
  'archimedes':        'Engineer',
  'platon':            'Architect',
  'leo':               'Designer',
  'aristotle':         'Analyst',
  'herodotus':         'Historian',
  'hephaestus':        'DevOps',
  'brainstorm-claude': 'Brainstorm (Claude)',
  'brainstorm-codex':  'Brainstorm (Codex)',
  'code-review-gate':  'Code Review',
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'sokrat':            'Сократ',
  'archimedes':        'Архимед',
  'platon':            'Платон',
  'leo':               'Лео',
  'aristotle':         'Аристотель',
  'herodotus':         'Геродот',
  'hephaestus':        'Гефест',
  'brainstorm-claude': 'Brainstorm Claude',
  'brainstorm-codex':  'Brainstorm Codex',
  'code-review-gate':  'Code Review Gate',
};

function normalizeActor(actor: string): string {
  if (actor === 'main') return 'sokrat';
  if (actor === 'brainstorm') return 'brainstorm-claude';
  return actor;
}

function getEmoji(actor: string): string {
  return AGENT_EMOJI[actor] ?? AGENT_EMOJI['unknown'];
}

function getTooltip(actor: string): string {
  const name = AGENT_DISPLAY_NAMES[actor] ?? actor;
  const role = AGENT_ROLES[actor];
  return role ? `${name} — ${role}` : name;
}

interface FlowStripProps {
  actors: string[];
  currentOwner?: string;
  maxVisible?: number;
}

export default function FlowStrip({ actors, currentOwner, maxVisible = 5 }: FlowStripProps) {
  const normalizedOwner = currentOwner ? normalizeActor(currentOwner) : null;
  const hasActors = actors && actors.length > 0;

  // If no actors and no currentOwner, render nothing
  if (!hasActors && !normalizedOwner) return null;

  let normalized = hasActors ? actors.map(normalizeActor) : [];

  // If currentOwner is absent from actors[], append it
  if (normalizedOwner && !normalized.includes(normalizedOwner)) {
    normalized = [...normalized, normalizedOwner];
  }

  // For overflow: ensure currentOwner stays visible
  // If owner would be hidden by overflow, adjust visible slice to include owner
  const overflow = normalized.length > maxVisible ? normalized.length - (maxVisible - 1) : 0;
  let visible: string[];
  if (overflow > 0) {
    const ownerIndex = normalizedOwner ? normalized.indexOf(normalizedOwner) : -1;
    const defaultVisible = normalized.slice(0, maxVisible - 1);
    if (normalizedOwner && ownerIndex >= maxVisible - 1) {
      // Owner would be hidden — replace last visible slot with owner
      visible = [...defaultVisible.slice(0, maxVisible - 2), normalizedOwner];
    } else {
      visible = defaultVisible;
    }
  } else {
    visible = normalized;
  }

  return (
    <div className="flex items-center gap-0.5 mt-1.5 flex-wrap max-sm:[&>span:nth-child(n+4)]:hidden" data-testid="flow-strip">
      {visible.map((actor, i) => {
        const isOwner = normalizedOwner !== null && actor === normalizedOwner;
        return (
          <span key={`${actor}-${i}`} className="flex items-center gap-0.5">
            {i > 0 && (
              <span className="text-text-disabled text-[10px]" aria-hidden="true">→</span>
            )}
            <span
              title={getTooltip(actor)}
              className={`inline-flex items-center justify-center rounded-full text-xs ${
                isOwner
                  ? 'w-6 h-6 bg-bg-overlay border border-amber ring-2 ring-amber/40'
                  : `w-5 h-5 bg-bg-overlay border border-border-subtle ${normalizedOwner ? 'opacity-60' : ''}`
              }`}
              role="img"
              aria-label={getTooltip(actor)}
            >
              {getEmoji(actor)}
            </span>
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="flex items-center gap-0.5">
          <span className="text-text-disabled text-[10px]" aria-hidden="true">→</span>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-overlay border border-border-subtle text-xs text-text-secondary font-mono"
            title={`${overflow} more agent${overflow > 1 ? 's' : ''}`}
          >
            +{overflow}
          </span>
        </span>
      )}
      {/* Mobile overflow: show +N for hidden avatars (>3 on small screens) */}
      {normalized.length > 3 && (
        <span
          className="hidden max-sm:inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-overlay border border-border-subtle text-xs text-text-secondary font-mono"
          title={`${normalized.length - 3} more agent${normalized.length - 3 > 1 ? 's' : ''}`}
        >
          +{normalized.length - 3}
        </span>
      )}
    </div>
  );
}
