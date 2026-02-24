import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/database'
import {
  LayoutDashboard,
  Building2,
  HardHat,
  ClipboardList,
  Settings,
  Zap,
} from 'lucide-react'

const navItems: { to: string; label: string; icon: React.ElementType; roles: UserRole[] }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['administrador', 'engenharia', 'rh'] },
  { to: '/clientes', label: 'Clientes', icon: Building2, roles: ['administrador', 'engenharia', 'rh'] },
  { to: '/obras', label: 'Obras', icon: HardHat, roles: ['administrador', 'engenharia', 'rh'] },
  { to: '/checklists', label: 'Checklists', icon: ClipboardList, roles: ['administrador', 'engenharia'] },
  { to: '/admin', label: 'Administração', icon: Settings, roles: ['administrador'] },
]

export function Sidebar() {
  const { role } = useAuth()

  const visibleItems = navItems.filter(item => item.roles.includes(role))

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-blue-950 text-white flex flex-col z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-blue-800">
        <div className="flex items-center justify-center w-9 h-9 bg-yellow-400 rounded-lg">
          <Zap className="h-5 w-5 text-blue-950" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight">EmpreSys</span>
          <p className="text-blue-300 text-xs">Gestão de Obras</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-blue-800">
        <p className="text-blue-400 text-xs text-center">v1.0 · Balneário Camboriú</p>
      </div>
    </aside>
  )
}
