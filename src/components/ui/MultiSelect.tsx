import { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'All',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (item: string) => {
    if (value.includes(item)) {
      onChange(value.filter((v) => v !== item));
    } else {
      onChange([...value, item]);
    }
  };

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  return (
    <div ref={ref} className="relative" data-testid="multi-select">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-bg-void border border-border-default rounded-sm px-2 py-1.5 text-sm font-mono text-text-primary focus:border-amber focus:outline-none flex items-center gap-1 min-w-[120px]"
        data-testid="multi-select-trigger"
      >
        <span className="truncate">{label}</span>
        <svg
          className={`w-3 h-3 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[160px] bg-bg-elevated border border-border-default rounded-sm shadow-panel py-1 max-h-[200px] overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1.5 text-sm font-mono text-text-primary hover:bg-bg-hover cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-amber w-3 h-3"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
          {options.length === 0 && (
            <span className="block px-2 py-1.5 text-sm text-text-tertiary">
              No options
            </span>
          )}
        </div>
      )}
    </div>
  );
}
