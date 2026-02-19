import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientesPage } from './pages/ClientesPage'
import { ObrasPage } from './pages/ObrasPage'
import { ObraDetalhePage } from './pages/ObraDetalhePage'
import { ChecklistsPage } from './pages/ChecklistsPage'
import { ChecklistDetalhePage } from './pages/ChecklistDetalhePage'
import { ChecklistExecucaoPage } from './pages/ChecklistExecucaoPage'
import { ChecklistRelatorioPage } from './pages/ChecklistRelatorioPage'
import { Toaster } from './components/ui/toaster'
import { Loader2 } from 'lucide-react'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout user={user} />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="obras" element={<ObrasPage />} />
        <Route path="obras/:id" element={<ObraDetalhePage />} />
        <Route path="checklists" element={<ChecklistsPage />} />
        <Route path="checklists/:id" element={<ChecklistDetalhePage />} />
        <Route path="checklists/:id/executar" element={<ChecklistExecucaoPage />} />
        <Route path="checklists/:id/relatorio" element={<ChecklistRelatorioPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
