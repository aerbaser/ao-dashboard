import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './components/layout/TopBar'
import Sidebar from './components/layout/Sidebar'
import { usePolling } from './hooks/usePolling'
import { getStatus } from './lib/api'

export default function App() {
  const { data: status } = usePolling(getStatus, 5000)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar status={status} onMenuToggle={() => setSidebarOpen((o) => !o)} />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar — hidden on mobile unless open */}
        <div
          className={`
            fixed md:relative z-30 md:z-auto h-full
            transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <Sidebar status={status} onClose={() => setSidebarOpen(false)} />
        </div>
        <main className="flex-1 overflow-auto p-3 md:p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
