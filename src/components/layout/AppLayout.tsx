import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import type { User } from '@supabase/supabase-js'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/obras': 'Obras',
  '/checklists': 'Checklists',
}

interface AppLayoutProps {
  user: User | null
}

export function AppLayout({ user }: AppLayoutProps) {
  const location = useLocation()

  const getTitle = () => {
    // Check exact matches first
    if (pageTitles[location.pathname]) return pageTitles[location.pathname]
    // Check prefix matches
    if (location.pathname.startsWith('/obras/')) return 'Detalhe da Obra'
    if (location.pathname.includes('/executar')) return 'Execução de Checklist'
    if (location.pathname.includes('/relatorio')) return 'Relatório do Checklist'
    if (location.pathname.startsWith('/checklists/')) return 'Detalhe do Checklist'
    return 'EmpreSys'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header user={user} title={getTitle()} />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
