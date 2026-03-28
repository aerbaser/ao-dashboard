import { useState, useCallback } from 'react';
import { addTaskEvent } from '../../lib/api';

interface CommentInputProps {
  taskId: string;
  onCommentAdded: () => void;
}

export function CommentInput({ taskId, onCommentAdded }: CommentInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await addTaskEvent(taskId, 'USER_COMMENT', { actor: 'owner', body });
      setText('');
      onCommentAdded();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || 'Failed to send comment');
    } finally {
      setSending(false);
    }
  }, [taskId, text, sending, onCommentAdded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs text-red font-mono">{error}</p>
      )}
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending}
        placeholder="Add a comment… (Ctrl+Enter to send)"
        className="w-full bg-bg-void border border-border-default rounded-sm px-2 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-amber focus:outline-none resize-none disabled:opacity-50"
      />
      <div className="flex justify-end">
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="px-3 py-1.5 rounded-sm bg-amber text-text-inverse font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
