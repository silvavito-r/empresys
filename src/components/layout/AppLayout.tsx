import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/obras': 'Obras',
  '/checklists': 'Checklists',
  '/admin': 'Administração do Sistema',
}

export function AppLayout() {
  const location = useLocation()

  const getTitle = () => {
    if (pageTitles[location.pathname]) return pageTitles[location.pathname]
    if (location.pathname.startsWith('/obras/')) return 'Detalhe da Obra'
    if (location.pathname.includes('/executar')) return 'Execução de Checklist'
    if (location.pathname.includes('/relatorio')) return 'Relatório do Checklist'
    if (location.pathname.startsWith('/checklists/')) return 'Detalhe do Checklist'
    return 'EmpreSys'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header title={getTitle()} />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
