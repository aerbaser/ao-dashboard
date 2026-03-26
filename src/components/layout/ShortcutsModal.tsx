import type { Shortcut } from '../../hooks/useKeyboardShortcuts'

interface Props {
  shortcuts: Shortcut[]
  onClose: () => void
}

export default function ShortcutsModal({ shortcuts, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[360px] bg-bg-elevated border border-border-subtle rounded-lg shadow-panel animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-sm">Esc</button>
        </div>
        <div className="p-4 space-y-2">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{s.description}</span>
              <kbd className="font-mono text-xs bg-bg-void border border-border-subtle rounded px-2 py-0.5 text-text-primary">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
