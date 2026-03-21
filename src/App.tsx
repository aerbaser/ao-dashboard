import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Config from './pages/Config'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/config" element={<Config />} />
        <Route path="*" element={<Navigate to="/config" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
