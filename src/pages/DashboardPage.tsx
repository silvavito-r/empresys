import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, HardHat, ClipboardList, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

interface DashboardStats {
  totalClientes: number
  totalObras: number
  obrasAtivas: number
  totalChecklists: number
  checklistsAtivos: number
  pendencias: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentObras, setRecentObras] = useState<{ id: string; nome: string; status: string; clientes: { nome: string } | null }[]>([])
  const [recentChecklists, setRecentChecklists] = useState<{ id: string; nome: string; status: string; obras: { nome: string } | null }[]>([])

  useEffect(() => {
    async function loadData() {
      const [
        { count: totalClientes },
        { count: totalObras },
        { count: obrasAtivas },
        { count: totalChecklists },
        { count: checklistsAtivos },
        { count: pendencias },
        { data: obras },
        { data: checklists },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('obras').select('*', { count: 'exact', head: true }),
        supabase.from('obras').select('*', { count: 'exact', head: true }).eq('status', 'ativa'),
        supabase.from('checklists').select('*', { count: 'exact', head: true }),
        supabase.from('checklists').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('checklist_execucoes').select('*', { count: 'exact', head: true }).eq('status', 'nao_ok'),
        supabase.from('obras').select('id, nome, status, clientes(nome)').order('created_at', { ascending: false }).limit(5),
        supabase.from('checklists').select('id, nome, status, obras(nome)').order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        totalClientes: totalClientes ?? 0,
        totalObras: totalObras ?? 0,
        obrasAtivas: obrasAtivas ?? 0,
        totalChecklists: totalChecklists ?? 0,
        checklistsAtivos: checklistsAtivos ?? 0,
        pendencias: pendencias ?? 0,
      })

      setRecentObras((obras as unknown as typeof recentObras) ?? [])
      setRecentChecklists((checklists as unknown as typeof recentChecklists) ?? [])
      setLoading(false)
    }

    loadData()
  }, [])

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'outline' | 'destructive' }> = {
      ativa: { label: 'Ativa', variant: 'success' },
      concluida: { label: 'Concluída', variant: 'secondary' },
      pausada: { label: 'Pausada', variant: 'warning' },
      rascunho: { label: 'Rascunho', variant: 'outline' },
      ativo: { label: 'Ativo', variant: 'success' },
      concluido: { label: 'Concluído', variant: 'secondary' },
    }
    const s = map[status] ?? { label: status, variant: 'outline' as const }
    return <Badge variant={s.variant}>{s.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
            <Building2 className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalClientes}</div>
            <p className="text-xs text-muted-foreground mt-1">Construtoras cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Obras</CardTitle>
            <HardHat className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalObras}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 font-medium">{stats?.obrasAtivas} ativas</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Checklists</CardTitle>
            <ClipboardList className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalChecklists}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 font-medium">{stats?.checklistsAtivos} em andamento</span>
            </p>
          </CardContent>
        </Card>

        <Card className={stats?.pendencias && stats.pendencias > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendências</CardTitle>
            <AlertCircle className={`h-5 w-5 ${stats?.pendencias && stats.pendencias > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats?.pendencias && stats.pendencias > 0 ? 'text-red-600' : ''}`}>
              {stats?.pendencias}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Itens não conformes</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Obras */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Obras Recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/obras">
                Ver todas <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentObras.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma obra cadastrada</p>
            ) : (
              recentObras.map((obra) => (
                <Link key={obra.id} to={`/obras/${obra.id}`} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                    <div>
                      <p className="font-medium text-sm">{obra.nome}</p>
                      <p className="text-xs text-muted-foreground">{obra.clientes?.nome ?? '—'}</p>
                    </div>
                    {statusBadge(obra.status)}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Checklists */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Checklists Recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/checklists">
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentChecklists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum checklist cadastrado</p>
            ) : (
              recentChecklists.map((cl) => (
                <Link key={cl.id} to={`/checklists/${cl.id}`} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                    <div>
                      <p className="font-medium text-sm">{cl.nome}</p>
                      <p className="text-xs text-muted-foreground">{cl.obras?.nome ?? '—'}</p>
                    </div>
                    {statusBadge(cl.status)}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
