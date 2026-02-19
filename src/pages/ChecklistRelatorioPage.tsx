import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ChecklistComObraCompleta, ChecklistItem, Pavimento, Unidade, Ambiente, ChecklistExecucao, ExecucaoStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, Printer, Check, X, Minus, AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusConfig: Record<ExecucaoStatus, { label: string; icon: React.ElementType; color: string; printColor: string }> = {
  pendente:      { label: 'Pendente',      icon: Minus, color: 'text-gray-400',   printColor: 'text-gray-500' },
  ok:            { label: 'OK',            icon: Check, color: 'text-green-600',  printColor: 'text-green-700' },
  nao_ok:        { label: 'Não OK',        icon: X,     color: 'text-red-600',    printColor: 'text-red-700' },
  nao_aplicavel: { label: 'N/A',           icon: Minus, color: 'text-yellow-600', printColor: 'text-yellow-700' },
}

function buildKey(e: ChecklistExecucao) {
  if (e.ambiente_id) return `amb:${e.ambiente_id}:${e.item_id}`
  if (e.unidade_id) return `unid:${e.unidade_id}:${e.item_id}`
  return `pav:${e.pavimento_id}:${e.item_id}`
}

export function ChecklistRelatorioPage() {
  const { id } = useParams<{ id: string }>()

  const [checklist, setChecklist] = useState<ChecklistComObraCompleta | null>(null)
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [execucoes, setExecucoes] = useState<ChecklistExecucao[]>([])
  const [execIndex, setExecIndex] = useState<Map<string, ChecklistExecucao>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<ExecucaoStatus | 'todos'>('todos')

  useEffect(() => {
    async function load() {
      if (!id) return
      const { data: cl } = await supabase
        .from('checklists')
        .select('*, obras(nome, endereco, responsavel, cliente_id, clientes(nome))')
        .eq('id', id).single()
      if (!cl) { setLoading(false); return }
      setChecklist(cl as ChecklistComObraCompleta)

      const obraId = (cl as { obra_id: string }).obra_id
      const [{ data: items }, { data: execs }, { data: pavs }] = await Promise.all([
        supabase.from('checklist_itens').select('*').eq('checklist_id', id).order('ordem'),
        supabase.from('checklist_execucoes').select('*').eq('checklist_id', id),
        supabase.from('pavimentos').select('*').eq('obra_id', obraId).order('ordem'),
      ])

      const execList = (execs ?? []) as ChecklistExecucao[]
      setItens((items as ChecklistItem[]) ?? [])
      setExecucoes(execList)

      const map = new Map<string, ChecklistExecucao>()
      execList.forEach(e => map.set(buildKey(e), e))
      setExecIndex(map)

      const pavList = (pavs ?? []) as Pavimento[]
      setPavimentos(pavList)

      if (pavList.length > 0) {
        const { data: unids } = await supabase.from('unidades').select('*').in('pavimento_id', pavList.map(p => p.id)).order('ordem')
        const unidList = (unids ?? []) as Unidade[]
        setUnidades(unidList)
        if (unidList.length > 0) {
          const { data: ambs } = await supabase.from('ambientes').select('*').in('unidade_id', unidList.map(u => u.id))
          setAmbientes((ambs ?? []) as Ambiente[])
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  const countStatus = (s: ExecucaoStatus) => execucoes.filter(e => e.status === s).length
  const okCount  = countStatus('ok')
  const nokCount = countStatus('nao_ok')
  const naCount  = countStatus('nao_aplicavel')
  const pendCount = countStatus('pendente')
  const total    = execucoes.length
  const progress = total === 0 ? 0 : Math.round(((okCount + nokCount + naCount) / total) * 100)

  const unidadesDoPav  = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)
  const ambientesDaUnid = (unidId: string) => ambientes.filter(a => a.unidade_id === unidId)

  const itensPav  = itens.filter(i => i.scope === 'pavimento')
  const itensUnid = itens.filter(i => i.scope === 'unidade')
  const itensAmb  = itens.filter(i => i.scope === 'ambiente')

  // Pendências por unidade (itens NOK ou pendentes)
  const pendencias = unidades.map(unid => {
    const pav = pavimentos.find(p => p.id === unid.pavimento_id)
    const nok  = itensUnid.filter(it => execIndex.get(`unid:${unid.id}:${it.id}`)?.status === 'nao_ok')
    const pend = itensUnid.filter(it => { const e = execIndex.get(`unid:${unid.id}:${it.id}`); return !e || e.status === 'pendente' })
    return { unid, pav, nok, pend }
  }).filter(r => r.nok.length > 0 || r.pend.length > 0)

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!checklist) return <div className="text-center py-16 text-muted-foreground">Checklist não encontrado.</div>

  const obra = checklist.obras
  const construtora = obra?.clientes?.nome ?? '—'

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Screen toolbar (hidden on print) ── */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/checklists/${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h2 className="font-bold text-lg flex-1">Relatório — {checklist.nome}</h2>
        <Button asChild variant="outline">
          <Link to={`/checklists/${id}/executar`}>Continuar execução</Link>
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />Imprimir / PDF
        </Button>
      </div>

      {/* ── PRINT HEADER (hidden on screen) ── */}
      <div className="hidden print:block">
        <style>{`
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          @media print {
            body { font-size: 11px; }
            .print\\:hidden { display: none !important; }
            .hidden.print\\:block, .hidden.print\\:table, .hidden.print\\:flex { display: revert !important; }
          }
        `}</style>

        <div className="flex items-center justify-between border-b-2 border-blue-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-800 rounded p-1.5">
              <Zap className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="font-bold text-blue-900 text-base leading-none">EmpreSys</p>
              <p className="text-xs text-gray-500">Gestão de Obras Elétricas</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Relatório gerado em {today}</p>
            <p>Verificação: {checklist.nome}</p>
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Relatório de Verificação Elétrica</h1>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="font-semibold text-gray-600 w-36 py-0.5">Construtora:</td>
                <td className="text-gray-900">{construtora}</td>
                <td className="font-semibold text-gray-600 w-36 py-0.5">Responsável:</td>
                <td className="text-gray-900">{obra?.responsavel ?? '—'}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 py-0.5">Obra:</td>
                <td className="text-gray-900">{obra?.nome ?? '—'}</td>
                <td className="font-semibold text-gray-600 py-0.5">Data:</td>
                <td className="text-gray-900">{today}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 py-0.5">Endereço:</td>
                <td className="text-gray-900" colSpan={3}>{obra?.endereco ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary cards (screen) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        {[
          { label: 'Conforme (OK)', value: okCount, color: 'text-green-600' },
          { label: 'Não Conforme', value: nokCount, color: 'text-red-600' },
          { label: 'Não Aplicável', value: naCount, color: 'text-yellow-600' },
          { label: 'Pendentes', value: pendCount, color: 'text-gray-400' },
        ].map(c => (
          <Card key={c.label} className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Summary table (print only) ── */}
      <div className="hidden print:block mb-4">
        <h2 className="font-bold text-sm uppercase tracking-wide text-gray-700 border-b pb-1 mb-2">Resumo</h2>
        <table className="w-full text-sm border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">Conformes (OK)</th>
              <th className="border border-gray-300 p-2 text-left">Não Conformes</th>
              <th className="border border-gray-300 p-2 text-left">Não Aplicável</th>
              <th className="border border-gray-300 p-2 text-left">Pendentes</th>
              <th className="border border-gray-300 p-2 text-left">Total</th>
              <th className="border border-gray-300 p-2 text-left">Progresso</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2 text-center font-bold text-green-700">{okCount}</td>
              <td className="border border-gray-300 p-2 text-center font-bold text-red-700">{nokCount}</td>
              <td className="border border-gray-300 p-2 text-center font-bold text-yellow-700">{naCount}</td>
              <td className="border border-gray-300 p-2 text-center font-bold text-gray-500">{pendCount}</td>
              <td className="border border-gray-300 p-2 text-center font-bold">{total}</td>
              <td className="border border-gray-300 p-2 text-center font-bold">{progress}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Progress bar (screen) ── */}
      <Card className="print:hidden">
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Progresso geral</span><span className="text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-muted-foreground">{total - pendCount} de {total} verificações realizadas</p>
        </CardContent>
      </Card>

      {/* ── Pendências ── */}
      {(pendencias.length > 0 || nokCount > 0) && (
        <div>
          {/* Screen */}
          <Card className="border-red-200 print:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />Pendências e Não Conformidades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PendenciasContent pendencias={pendencias} execIndex={execIndex} />
            </CardContent>
          </Card>

          {/* Print */}
          <div className="hidden print:block mb-4">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-700 border-b pb-1 mb-2">
              Pendências e Não Conformidades
            </h2>
            {pendencias.length === 0
              ? <p className="text-sm text-gray-500 italic">Nenhuma pendência encontrada.</p>
              : <PendenciasContent pendencias={pendencias} execIndex={execIndex} />
            }
          </div>
        </div>
      )}

      {/* ── Detail tables ── */}
      <div className="space-y-6">
        {/* Screen filter */}
        <div className="flex items-center gap-3 print:hidden">
          <h3 className="font-semibold">Detalhamento por Local</h3>
          <div className="flex gap-2">
            {(['todos', 'ok', 'nao_ok', 'pendente'] as const).map(f => (
              <Button key={f} size="sm" variant={filterStatus === f ? 'default' : 'outline'}
                onClick={() => setFilterStatus(f)}>
                {f === 'todos' ? 'Todos' : f === 'ok' ? 'OK' : f === 'nao_ok' ? 'Não OK' : 'Pendentes'}
              </Button>
            ))}
          </div>
        </div>

        {/* Print section title */}
        <h2 className="hidden print:block font-bold text-sm uppercase tracking-wide text-gray-700 border-b pb-1">
          Detalhamento por Local
        </h2>

        {/* Pavimento-scoped table */}
        {itensPav.length > 0 && (
          <DetailSection title="Verificações por Pavimento" color="blue">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-50 print:bg-gray-100">
                  <th className="text-left p-2 font-medium border">Item de Verificação</th>
                  {pavimentos.map(pav => (
                    <th key={pav.id} className="p-2 font-medium border text-center min-w-[70px]">{pav.nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itensPav.map(item => {
                  const cells = pavimentos.map(pav => ({ pav, exec: execIndex.get(`pav:${pav.id}:${item.id}`) }))
                  if (filterStatus !== 'todos') {
                    const match = cells.some(c => filterStatus === 'pendente'
                      ? !c.exec || c.exec.status === 'pendente'
                      : c.exec?.status === filterStatus)
                    if (!match) return null
                  }
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 border">{item.nome}</td>
                      {cells.map(({ pav, exec }) => {
                        const s = (exec?.status ?? 'pendente') as ExecucaoStatus
                        const cfg = statusConfig[s]; const Icon = cfg.icon
                        return (
                          <td key={pav.id} className="p-2 border text-center">
                            <Icon className={cn('h-4 w-4 mx-auto', cfg.color)} />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DetailSection>
        )}

        {/* Unidade-scoped tables per pavimento */}
        {itensUnid.length > 0 && pavimentos.map(pav => {
          const pavUnids = unidadesDoPav(pav.id)
          if (pavUnids.length === 0) return null
          return (
            <DetailSection key={pav.id} title={`Unidades — ${pav.nome}`} color="green">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-green-50 print:bg-gray-100">
                    <th className="text-left p-2 font-medium border">Item de Verificação</th>
                    {pavUnids.map(u => <th key={u.id} className="p-2 font-medium border text-center min-w-[50px]">{u.nome}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {itensUnid.map(item => {
                    const cells = pavUnids.map(u => ({ u, exec: execIndex.get(`unid:${u.id}:${item.id}`) }))
                    if (filterStatus !== 'todos') {
                      const match = cells.some(c => filterStatus === 'pendente'
                        ? !c.exec || c.exec.status === 'pendente'
                        : c.exec?.status === filterStatus)
                      if (!match) return null
                    }
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 border">{item.nome}</td>
                        {cells.map(({ u, exec }) => {
                          const s = (exec?.status ?? 'pendente') as ExecucaoStatus
                          const cfg = statusConfig[s]; const Icon = cfg.icon
                          return (
                            <td key={u.id} className="p-2 border text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <Icon className={cn('h-4 w-4', cfg.color)} />
                                {exec?.nota && <span className="text-[9px] text-blue-500">nota</span>}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </DetailSection>
          )
        })}

        {/* Ambiente-scoped tables */}
        {itensAmb.length > 0 && unidades.map(unid => {
          const ambs = ambientesDaUnid(unid.id)
          const pav = pavimentos.find(p => p.id === unid.pavimento_id)
          if (ambs.length === 0) return null
          return (
            <DetailSection key={unid.id} title={`Ambientes — ${pav?.nome} / ${unid.nome}`} color="purple">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-purple-50 print:bg-gray-100">
                    <th className="text-left p-2 font-medium border">Item de Verificação</th>
                    {ambs.map(a => <th key={a.id} className="p-2 font-medium border text-center min-w-[60px]">{a.nome}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {itensAmb.map(item => {
                    const cells = ambs.map(a => ({ a, exec: execIndex.get(`amb:${a.id}:${item.id}`) }))
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 border">{item.nome}</td>
                        {cells.map(({ a, exec }) => {
                          const s = (exec?.status ?? 'pendente') as ExecucaoStatus
                          const cfg = statusConfig[s]; const Icon = cfg.icon
                          return (
                            <td key={a.id} className="p-2 border text-center">
                              <Icon className={cn('h-4 w-4 mx-auto', cfg.color)} />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </DetailSection>
          )
        })}
      </div>

      {/* ── Legend ── */}
      <div className="border rounded-lg p-3 print:border-gray-300">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Legenda</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Conforme (OK)</span>
          <span className="flex items-center gap-1"><X className="h-3.5 w-3.5 text-red-600" />Não Conforme</span>
          <span className="flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-yellow-600" />Não Aplicável</span>
          <span className="flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-gray-400" />Pendente</span>
        </div>
      </div>

      {/* Print footer */}
      <div className="hidden print:block border-t pt-3 text-xs text-gray-400 text-center">
        EmpreSys — Gestão de Obras Elétricas · Relatório gerado em {today}
      </div>
    </div>
  )
}

// ── Sub-components ──

function DetailSection({ title, color, children }: { title: string; color: 'blue' | 'green' | 'purple'; children: React.ReactNode }) {
  const colorMap = {
    blue:   'text-blue-800 border-blue-200',
    green:  'text-green-800 border-green-200',
    purple: 'text-purple-800 border-purple-200',
  }
  return (
    <div className="space-y-2">
      <h4 className={`font-semibold text-sm border-b pb-1 print:text-gray-700 print:border-gray-300 ${colorMap[color]}`}>{title}</h4>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function PendenciasContent({
  pendencias,
  execIndex,
}: {
  pendencias: Array<{ unid: Unidade; pav: Pavimento | undefined; nok: ChecklistItem[]; pend: ChecklistItem[] }>
  execIndex: Map<string, ChecklistExecucao>
}) {
  if (pendencias.length === 0) return <p className="text-sm text-muted-foreground italic">Nenhuma pendência encontrada.</p>
  return (
    <div className="space-y-3">
      {pendencias.map(({ unid, pav, nok, pend }) => (
        <div key={unid.id}>
          <p className="font-semibold text-sm mb-1">{pav?.nome} — {unid.nome}</p>
          {nok.map(item => {
            const exec = execIndex.get(`unid:${unid.id}:${item.id}`)
            return (
              <div key={item.id} className="ml-4 text-sm border-l-2 border-red-400 pl-3 mb-1">
                <div className="flex items-center gap-2">
                  <X className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                  <span>{item.nome}</span>
                </div>
                {exec?.nota && <p className="text-xs text-muted-foreground ml-5">Nota: {exec.nota}</p>}
              </div>
            )
          })}
          {pend.map(item => (
            <div key={item.id} className="ml-4 text-sm border-l-2 border-gray-300 pl-3 mb-1 text-gray-500">
              <div className="flex items-center gap-2">
                <Minus className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{item.nome} — Pendente</span>
              </div>
            </div>
          ))}
          <Separator className="mt-3" />
        </div>
      ))}
    </div>
  )
}
