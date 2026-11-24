import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import './cas.css'
import './demo.css'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import ProtectedRoute from './components/ProtectedRoute'
import { AppShell, Dashboard } from './pages/Dashboard'
import Schemes from './pages/Schemes'
import Documents from './pages/Documents'
import LegalAssistant from './pages/LegalAssistant'
import SmartForms from './pages/SmartForms'
import Profile from './pages/Profile'
import Applications from './pages/Applications'
import PasswordUpdate from './pages/PasswordUpdate'
import Notifications from './pages/Notifications'

function App() {
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/password/update" element={<PasswordUpdate />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/schemes" element={<Schemes />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/legal" element={<LegalAssistant />} />
        <Route path="/forms" element={<SmartForms />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

export default App

