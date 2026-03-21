import { useEffect, useMemo, useState } from 'react'
import type { CronEntry } from '../../lib/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const ROW_HEIGHT = 56
const GROUP_STYLES: Record<string, string> = {
  'AO Pipeline': 'border-amber/40 bg-amber-subtle text-amber',
  Maintenance: 'border-blue/40 bg-blue-subtle text-blue',
  Sync: 'border-emerald/40 bg-emerald-subtle text-emerald',
  Other: 'border-border-default bg-bg-overlay text-text-secondary',
}

interface CalendarBlock {
  key: string
  entryId: string
  day: number
  hour: number
  minute: number
  label: string
  group: string
}

interface CronCalendarProps {
  entries: CronEntry[]
  loading: boolean
  saving?: boolean
  onEntriesChange: (entries: CronEntry[]) => void | Promise<void>
}

function parseField(field: string, min: number, max: number) {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index)
  }

  const values = new Set<number>()
  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/)
    if (!stepMatch) continue
    const [, base, stepRaw] = stepMatch
    const step = stepRaw ? Number(stepRaw) : 1
    if (base === '*') {
      for (let value = min; value <= max; value += step) values.add(value)
      continue
    }
    if (base.includes('-')) {
      const [start, end] = base.split('-').map(Number)
      for (let value = start; value <= end; value += step) {
        if (value >= min && value <= max) values.add(value)
      }
      continue
    }
    const value = Number(base)
    if (value >= min && value <= max) values.add(value)
  }

  return [...values].sort((left, right) => left - right)
}

function normalizeWeekday(value: number) {
  if (value === 7) return 0
  return value
}

function toCalendarBlocks(entries: CronEntry[]): CalendarBlock[] {
  return entries.flatMap((entry) => {
    const [minuteField, hourField, , , weekdayField] = entry.schedule.split(/\s+/)
    const minutes = parseField(minuteField, 0, 59)
    const hours = parseField(hourField, 0, 23)
    const weekdays = parseField(weekdayField, 0, 7).map(normalizeWeekday)

    return weekdays.flatMap((day) =>
      hours.flatMap((hour) =>
        minutes.slice(0, 1).map((minute) => ({
          key: `${entry.id}-${day}-${hour}-${minute}`,
          entryId: entry.id,
          day,
          hour,
          minute,
          label: entry.label,
          group: entry.group,
        })),
      ),
    )
  })
}

function updateSchedule(entry: CronEntry, updates: { day?: number; hour?: number; minute?: number; schedule?: string }) {
  if (updates.schedule) {
    return { ...entry, schedule: updates.schedule }
  }

  const [minute, hour, dayOfMonth, month, weekday] = entry.schedule.split(/\s+/)
  return {
    ...entry,
    schedule: [
      updates.minute ?? minute,
      updates.hour ?? hour,
      dayOfMonth,
      month,
      updates.day ?? weekday,
    ].join(' '),
  }
}

function toneClass(group: string) {
  return GROUP_STYLES[group] ?? GROUP_STYLES.Other
}

export default function CronCalendar({ entries, loading, saving = false, onEntriesChange }: CronCalendarProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CronEntry | null>(null)
  const blocks = useMemo(() => toCalendarBlocks(entries.filter((entry) => entry.enabled)), [entries])

  useEffect(() => {
    if (!selectedId) {
      setDraft(null)
      return
    }
    setDraft(entries.find((entry) => entry.id === selectedId) ?? null)
  }, [entries, selectedId])

  const selectedEntry = draft

  if (loading && entries.length === 0) {
    return <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-sm text-text-tertiary">Loading cron schedule…</div>
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface shadow-panel">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Cron Calendar</h2>
          <p className="mt-1 text-xs text-text-tertiary">Weekly view with inline editing for existing jobs.</p>
        </div>
        {saving && <span className="font-mono text-xs text-amber">Saving…</span>}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[920px] grid-cols-[72px_repeat(7,minmax(110px,1fr))]">
          <div className="border-r border-border-subtle bg-bg-base" />
          {DAYS.map((day) => (
            <div key={day} className="border-b border-r border-border-subtle bg-bg-base px-3 py-2 text-center font-mono text-xs text-text-secondary last:border-r-0">
              {day}
            </div>
          ))}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-r border-border-subtle px-3 py-2 font-mono text-xs text-text-tertiary">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {DAYS.map((_, dayIndex) => (
                <div
                  key={`${hour}-${dayIndex}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const entryId = event.dataTransfer.getData('text/plain')
                    const nextEntries = entries.map((entry) => (
                      entry.id === entryId
                        ? updateSchedule(entry, { day: dayIndex, hour })
                        : entry
                    ))
                    void onEntriesChange(nextEntries)
                  }}
                  className="relative border-b border-r border-border-subtle bg-bg-elevated/40"
                  style={{ height: `${ROW_HEIGHT}px` }}
                />
              ))}
            </div>
          ))}

          <div className="pointer-events-none col-start-2 col-end-9 row-start-2 row-end-[26] grid grid-cols-7">
            {DAYS.map((_, dayIndex) => (
              <div key={dayIndex} className="relative">
                {blocks
                  .filter((block) => block.day === dayIndex)
                  .map((block) => (
                    <button
                      key={block.key}
                      type="button"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', block.entryId)}
                      onClick={() => setSelectedId(block.entryId)}
                      className={`pointer-events-auto absolute left-2 right-2 rounded-md border px-2 py-1 text-left shadow-sm transition-transform hover:scale-[1.01] ${toneClass(block.group)}`}
                      style={{ top: `${block.hour * ROW_HEIGHT + (block.minute / 60) * ROW_HEIGHT + 4}px` }}
                    >
                      <span className="block truncate font-mono text-[11px]">
                        {block.hour.toString().padStart(2, '0')}:{block.minute.toString().padStart(2, '0')}
                      </span>
                      <span className="mt-1 block truncate text-xs font-medium">{block.label}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedEntry && (
        <div className="border-t border-border-subtle bg-bg-elevated px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Edit Job</h3>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="font-mono text-xs text-text-tertiary hover:text-text-primary"
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-text-secondary">
              Schedule
              <input
                value={selectedEntry.schedule}
                onChange={(event) => setDraft({ ...selectedEntry, schedule: event.target.value })}
                className="mt-1 w-full rounded-sm border border-border-default bg-bg-void px-3 py-2 font-mono text-sm text-text-primary"
              />
            </label>
            <label className="text-xs text-text-secondary">
              Label
              <input
                value={selectedEntry.label}
                onChange={(event) => setDraft({ ...selectedEntry, label: event.target.value })}
                className="mt-1 w-full rounded-sm border border-border-default bg-bg-void px-3 py-2 font-mono text-sm text-text-primary"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={selectedEntry.enabled}
                onChange={(event) => setDraft({ ...selectedEntry, enabled: event.target.checked })}
              />
              Enabled
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextEntries = entries.map((entry) => entry.id === selectedEntry.id ? selectedEntry : entry)
                  void onEntriesChange(nextEntries)
                  setSelectedId(null)
                }}
                className="rounded-sm bg-amber px-3 py-2 text-xs font-semibold text-text-inverse"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextEntries = entries.filter((entry) => entry.id !== selectedEntry.id)
                  void onEntriesChange(nextEntries)
                  setSelectedId(null)
                }}
                className="rounded-sm border border-red/40 bg-red-subtle px-3 py-2 text-xs font-semibold text-red"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
