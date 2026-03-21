import { useState } from 'react'
import ConfigViewer from '../components/config/ConfigViewer'
import SkillsBrowser from '../components/config/SkillsBrowser'
import MemoryBrowser from '../components/config/MemoryBrowser'
import TeamManifest from '../components/config/TeamManifest'

const TABS = ['Gateway', 'Team', 'Skills', 'Memory'] as const
type Tab = (typeof TABS)[number]

export default function Config() {
  const [tab, setTab] = useState<Tab>('Gateway')

  return (
    <div className="min-h-screen bg-bg-base text-text-primary font-ui">
      {/* Header */}
      <div className="border-b border-border-subtle px-6 py-3">
        <h1 className="text-lg font-semibold">Config</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border-subtle px-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              tab === t
                ? 'text-amber'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === 'Gateway' && <ConfigViewer />}
        {tab === 'Team' && <TeamManifest />}
        {tab === 'Skills' && <SkillsBrowser />}
        {tab === 'Memory' && <MemoryBrowser />}
      </div>
    </div>
  )
}
