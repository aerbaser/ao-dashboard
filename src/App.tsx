import { Outlet } from 'react-router-dom'
import TopBar from './components/layout/TopBar'
import Sidebar from './components/layout/Sidebar'
import { usePolling } from './hooks/usePolling'
import { getStatus } from './lib/api'

export default function App() {
  const { data: status } = usePolling(getStatus, 5000)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar status={status} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar status={status} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
