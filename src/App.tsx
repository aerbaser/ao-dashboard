import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AgentsPage from './pages/Agents'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
