import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import type { GlobalStatus } from '../../lib/types'

interface SidebarProps {
  status: GlobalStatus | null
  onClose?: () => void
}

const LS_KEY = 'sidebar_collapsed'

interface NavItem {
  to: string
  label: string
  icon: string
  badge: (s: GlobalStatus | null) => number | null
  badgeColor: 'red' | 'amber'
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Pipeline',
    icon: '⚡',
    badge: (s) => {
      if (!s) return null
      const count = s.blocked_tasks + s.stuck_tasks
      return count > 0 ? count : null
    },
    badgeColor: 'red',
  },
  {
    to: '/agents',
    label: 'Agents',
    icon: '🤖',
    badge: (s) => {
      if (!s) return null
      const dead = s.agents_total - s.agents_alive
      return dead > 0 ? dead : null
    },
    badgeColor: 'red',
  },
  {
    to: '/system',
    label: 'System',
    icon: '🖥',
    badge: (s) => {
      if (!s) return null
      return s.failed_services > 0 ? s.failed_services : null
    },
    badgeColor: 'amber',
  },
  {
    to: '/logs',
    label: 'Logs',
    icon: '📋',
    badge: () => null, // TODO: error count from logs endpoint
    badgeColor: 'red',
  },
  {
    to: '/config',
    label: 'Config',
    icon: '⚙',
    badge: () => null,
    badgeColor: 'amber',
  },
]

function Badge({ count, color }: { count: number | null; color: 'red' | 'amber' }) {
  if (count === null) return null
  const bg = color === 'red' ? 'bg-accent-red' : 'bg-accent-amber'
  return (
    <span
      className={`${bg} text-text-inverse text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}
    >
      {count}
    </span>
  )
}

export default function Sidebar({ status, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, String(collapsed))
    } catch {
      // ignore
    }
  }, [collapsed])

  return (
    <nav
      className="h-full bg-bg-surface border-r border-border-subtle flex flex-col shrink-0 transition-[width] duration-200"
      style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)' }}
    >
      <div className="flex-1 pt-2 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200 border-l-2 ${
                isActive
                  ? 'bg-[#1f1a0a] border-amber text-amber'
                  : 'border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
            {!collapsed && (
              <span className="flex-1 truncate">{item.label}</span>
            )}
            <Badge count={item.badge(status)} color={item.badgeColor} />
          </NavLink>
        ))}
      </div>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center py-3 border-t border-border-subtle text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="text-sm">{collapsed ? '▶' : '◀'}</span>
      </button>
    </nav>
  )
}
