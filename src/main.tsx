import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PipelinePage from './pages/PipelinePage'
import AgentsPage from './pages/AgentsPage'
import SystemPage from './pages/SystemPage'
import LogsPage from './pages/LogsPage'
import ConfigPage from './pages/ConfigPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<PipelinePage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="config" element={<ConfigPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
