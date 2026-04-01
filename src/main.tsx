import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PipelinePage from './pages/Pipeline'
import AgentsPage from './pages/AgentsPage'
import SystemPage from './pages/SystemPage'
import LogsPage from './pages/LogsPage'
import ConfigPage from './pages/ConfigPage'
import IdeasPage from './pages/IdeasPage'
import ApprovalsPage from './pages/ApprovalsPage'
import { ToastProvider } from './hooks/useToast'
import ErrorBoundary from './components/layout/ErrorBoundary'
import ToastStack from './components/layout/Toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<ErrorBoundary><PipelinePage /></ErrorBoundary>} />
            <Route path="ideas" element={<ErrorBoundary><IdeasPage /></ErrorBoundary>} />
            <Route path="approvals" element={<ErrorBoundary><ApprovalsPage /></ErrorBoundary>} />
            <Route path="agents" element={<ErrorBoundary><AgentsPage /></ErrorBoundary>} />
            <Route path="system" element={<ErrorBoundary><SystemPage /></ErrorBoundary>} />
            <Route path="logs" element={<ErrorBoundary><LogsPage /></ErrorBoundary>} />
            <Route path="config" element={<ErrorBoundary><ConfigPage /></ErrorBoundary>} />
          </Route>
        </Routes>
        <ToastStack />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>,
)
