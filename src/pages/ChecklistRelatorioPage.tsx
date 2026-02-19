import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Checklist, ChecklistItem, Pavimento, Unidade, ChecklistExecucao, ExecucaoStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, Printer, Check, X, Minus, AlertTriangle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

const statusConfig: Record<ExecucaoStatus, { label: string; icon: React.ElementType; color: string }> = {
  pendente: { label: 'Pendente', icon: Minus, color: 'text-gray-400' },
  ok: { label: 'OK', icon: Check, color: 'text-green-600' },
  nao_ok: { label: 'Não OK', icon: X, color: 'text-red-600' },
  nao_aplicavel: { label: 'N/A', icon: Minus, color: 'text-yellow-600' },
}

export function ChecklistRelatorioPage() {
  const { id } = useParams<{ id: string }>()

  const [checklist, setChecklist] = useState<Checklist & { obras: { nome: string } | null } | null>(null)
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [execucoes, setExecucoes] = useState<ChecklistExecucao[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<ExecucaoStatus | 'todos'>('todos')

  useEffect(() => {
    async function loadData() {
      if (!id) return
      const { data: cl } = await supabase.from('checklists').select('*, obras(nome)').eq('id', id).single()
      if (!cl) { setLoading(false); return }
      setChecklist(cl as typeof checklist)

      const [{ data: items }, { data: execs }] = await Promise.all([
        supabase.from('checklist_itens').select('*').eq('checklist_id', id).order('ordem'),
        supabase.from('checklist_execucoes').select('*').eq('checklist_id', id),
      ])

      setItens(items ?? [])
      const execList = execs ?? []
      setExecucoes(execList)

      if (execList.length > 0) {
        const unidIds = [...new Set(execList.map(e => e.unidade_id))]
        const { data: unids } = await supabase.from('unidades').select('*').in('id', unidIds).order('ordem')
        const pavIds = [...new Set((unids ?? []).map(u => u.pavimento_id))]
        const { data: pavs } = await supabase.from('pavimentos').select('*').in('id', pavIds).order('ordem')
        setPavimentos(pavs ?? [])
        setUnidades(unids ?? [])
      }
      setLoading(false)
    }
    loadData()
  }, [id])

  const getExec = (itemId: string, unidId: string) =>
    execucoes.find(e => e.item_id === itemId && e.unidade_id === unidId)

  const totalExecs = execucoes.length
  const countStatus = (s: ExecucaoStatus) => execucoes.filter(e => e.status === s).length
  const okCount = countStatus('ok')
  const nokCount = countStatus('nao_ok')
  const naCount = countStatus('nao_aplicavel')
  const pendCount = countStatus('pendente')
  const progress = totalExecs === 0 ? 0 : Math.round(((okCount + nokCount + naCount) / totalExecs) * 100)

  const unidadesDoPav = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)

  const pendenciasPorUnidade = unidades.map(unid => ({
    unid,
    pav: pavimentos.find(p => p.id === unid.pavimento_id),
    itensNok: itens.filter(item => getExec(item.id, unid.id)?.status === 'nao_ok'),
    itensPend: itens.filter(item => {
      const e = getExec(item.id, unid.id)
      return !e || e.status === 'pendente'
    }),
  })).filter(u => u.itensNok.length > 0 || u.itensPend.length > 0)

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!checklist) return <div className="text-center py-16 text-muted-foreground">Checklist não encontrado.</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/checklists/${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h2 className="font-bold text-lg flex-1">Relatório — {checklist.nome}</h2>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" />Imprimir
        </Button>
        <Button asChild>
          <Link to={`/checklists/${id}/executar`}>Continuar execução</Link>
        </Button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">EmpreSys — Relatório de Checklist</h1>
        <p className="text-lg">{checklist.nome}</p>
        <p className="text-sm text-gray-600">Obra: {checklist.obras?.nome} · Gerado em: {formatDateTime(new Date().toISOString())}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-3xl font-bold text-green-600">{okCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Conforme (OK)</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-3xl font-bold text-red-600">{nokCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Não Conforme</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-3xl font-bold text-yellow-600">{naCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Não Aplicável</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-3xl font-bold text-gray-400">{pendCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Progresso geral</span>
            <span className="text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-muted-foreground">{totalExecs - pendCount} de {totalExecs} verificações realizadas</p>
        </CardContent>
      </Card>

      {/* Pendências highlight */}
      {pendenciasPorUnidade.length > 0 && (
        <Card className="border-red-200 print:border-gray-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-700 print:text-black">
              <AlertTriangle className="h-5 w-5" />
              Pendências e Não Conformidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendenciasPorUnidade.map(({ unid, pav, itensNok, itensPend }) => (
              <div key={unid.id} className="space-y-2">
                <p className="font-semibold text-sm">{pav?.nome} — {unid.nome}</p>
                {itensNok.map(item => {
                  const exec = getExec(item.id, unid.id)
                  return (
                    <div key={item.id} className="ml-4 text-sm border-l-2 border-red-400 pl-3">
                      <div className="flex items-center gap-2">
                        <X className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                        <span>{item.nome}</span>
                      </div>
                      {exec?.nota && <p className="text-xs text-muted-foreground mt-0.5 ml-5">Nota: {exec.nota}</p>}
                      {exec?.foto_url && <a href={exec.foto_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 ml-5 underline">Ver foto</a>}
                    </div>
                  )
                })}
                {itensPend.map(item => (
                  <div key={item.id} className="ml-4 text-sm border-l-2 border-gray-300 pl-3">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Minus className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{item.nome} — Pendente</span>
                    </div>
                  </div>
                ))}
                <Separator />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Full detail table per pavimento */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 print:hidden">
          <h3 className="font-semibold">Detalhe completo</h3>
          <div className="flex gap-2">
            {(['todos', 'ok', 'nao_ok', 'pendente'] as const).map(f => (
              <Button key={f} size="sm" variant={filterStatus === f ? 'default' : 'outline'}
                onClick={() => setFilterStatus(f)}>
                {f === 'todos' ? 'Todos' : f === 'ok' ? 'OK' : f === 'nao_ok' ? 'Não OK' : 'Pendentes'}
              </Button>
            ))}
          </div>
        </div>

        {pavimentos.map(pav => {
          const pavUnids = unidadesDoPav(pav.id)
          return (
            <div key={pav.id} className="space-y-2">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-1">{pav.nome}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2 font-medium border">Item de Verificação</th>
                      {pavUnids.map(u => (
                        <th key={u.id} className="p-2 font-medium border text-center min-w-[60px]">{u.nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(item => {
                      const rowExecs = pavUnids.map(u => getExec(item.id, u.id))
                      if (filterStatus !== 'todos') {
                        const hasFilter = rowExecs.some(e =>
                          filterStatus === 'pendente' ? (!e || e.status === 'pendente') : e?.status === filterStatus
                        )
                        if (!hasFilter) return null
                      }
                      return (
                        <tr key={item.id} className="border-b hover:bg-muted/30">
                          <td className="p-2 border">{item.nome}</td>
                          {pavUnids.map(u => {
                            const exec = getExec(item.id, u.id)
                            const s = (exec?.status ?? 'pendente') as ExecucaoStatus
                            const cfg = statusConfig[s]
                            const Icon = cfg.icon
                            return (
                              <td key={u.id} className="p-2 border text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Icon className={cn('h-4 w-4', cfg.color)} />
                                  {exec?.nota && <span className="text-[10px] text-blue-500">nota</span>}
                                  {exec?.foto_url && <span className="text-[10px] text-green-500">foto</span>}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <Card className="print:border-gray-300">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Conforme</span>
            <span className="flex items-center gap-1"><X className="h-3.5 w-3.5 text-red-600" />Não Conforme</span>
            <span className="flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-yellow-600" />Não Aplicável</span>
            <span className="flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-gray-400" />Pendente</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
