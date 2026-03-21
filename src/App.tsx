import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Logs from './pages/Logs'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/logs" element={<Logs />} />
        <Route path="*" element={<Navigate to="/logs" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
