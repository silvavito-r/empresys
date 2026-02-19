import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Checklist, ChecklistItem, ItemScope, Pavimento, Unidade, Ambiente } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, Plus, Trash2, Loader2, Play, GripVertical,
  ClipboardList, CheckCircle2, AlertCircle, Layers, Home, Grid3x3,
} from 'lucide-react'

const scopeLabel: Record<ItemScope, string> = {
  pavimento: 'Por Pavimento',
  unidade: 'Por Unidade',
  ambiente: 'Por Ambiente',
}

const scopeIcon: Record<ItemScope, React.ElementType> = {
  pavimento: Layers,
  unidade: Home,
  ambiente: Grid3x3,
}

const scopeBadgeClass: Record<ItemScope, string> = {
  pavimento: 'text-blue-700 bg-blue-50 border border-blue-200',
  unidade: 'text-green-700 bg-green-50 border border-green-200',
  ambiente: 'text-purple-700 bg-purple-50 border border-purple-200',
}

const scopeDesc: Record<ItemScope, string> = {
  pavimento: '1 verificação por pavimento',
  unidade: '1 verificação por unidade',
  ambiente: '1 verificação por ambiente',
}

export function ChecklistDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [checklist, setChecklist] = useState<Checklist & { obras: { nome: string; id: string } | null } | null>(null)
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [novoItem, setNovoItem] = useState('')
  const [novoScope, setNovoScope] = useState<ItemScope>('unidade')
  const [addingItem, setAddingItem] = useState(false)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    const { data: cl } = await supabase
      .from('checklists')
      .select('*, obras(nome, id)')
      .eq('id', id)
      .single()

    if (!cl) { setLoading(false); return }
    setChecklist(cl as typeof checklist)

    const obraId = (cl as { obra_id: string }).obra_id
    const [{ data: items }, { data: pavs }] = await Promise.all([
      supabase.from('checklist_itens').select('*').eq('checklist_id', id).order('ordem'),
      supabase.from('pavimentos').select('*').eq('obra_id', obraId).order('ordem'),
    ])

    setItens((items as ChecklistItem[]) ?? [])
    const pavList = pavs ?? []
    setPavimentos(pavList)

    if (pavList.length > 0) {
      const pavIds = pavList.map(p => p.id)
      const { data: unids } = await supabase.from('unidades').select('*').in('pavimento_id', pavIds).order('ordem')
      const unidList = unids ?? []
      setUnidades(unidList)
      if (unidList.length > 0) {
        const unidIds = unidList.map(u => u.id)
        const { data: ambs } = await supabase.from('ambientes').select('*').in('unidade_id', unidIds)
        setAmbientes(ambs ?? [])
      }
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const addItem = async () => {
    if (!novoItem.trim() || !id) return
    setAddingItem(true)
    const { error } = await supabase.from('checklist_itens').insert({
      checklist_id: id,
      nome: novoItem.trim(),
      ordem: itens.length,
      scope: novoScope,
    })
    if (error) { toast({ variant: 'destructive', title: 'Erro ao adicionar item' }) }
    else { setNovoItem(''); loadData() }
    setAddingItem(false)
  }

  const removeItem = async (itemId: string) => {
    await supabase.from('checklist_itens').delete().eq('id', itemId)
    loadData()
  }

  const itensPorScope = (scope: ItemScope) => itens.filter(i => i.scope === scope)

  const calcVerificacoes = () => {
    let total = 0
    for (const item of itens) {
      if (item.scope === 'pavimento') total += pavimentos.length
      else if (item.scope === 'ambiente') total += ambientes.length
      else total += unidades.length
    }
    return total
  }

  const ativarChecklist = async () => {
    if (itens.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione pelo menos um item antes de ativar' }); return
    }
    if (itensPorScope('unidade').length > 0 && unidades.length === 0) {
      toast({ variant: 'destructive', title: 'A obra não possui unidades cadastradas' }); return
    }
    if (itensPorScope('ambiente').length > 0 && ambientes.length === 0) {
      toast({ variant: 'destructive', title: 'A obra não possui ambientes cadastrados' }); return
    }

    setActivating(true)
    const execucoes: object[] = []

    for (const item of itensPorScope('pavimento')) {
      for (const pav of pavimentos) {
        execucoes.push({ checklist_id: id!, item_id: item.id, pavimento_id: pav.id, unidade_id: null, ambiente_id: null, status: 'pendente' })
      }
    }
    for (const item of itensPorScope('unidade')) {
      for (const unid of unidades) {
        const pav = pavimentos.find(p => p.id === unid.pavimento_id)
        if (!pav) continue
        execucoes.push({ checklist_id: id!, item_id: item.id, pavimento_id: pav.id, unidade_id: unid.id, ambiente_id: null, status: 'pendente' })
      }
    }
    for (const item of itensPorScope('ambiente')) {
      for (const amb of ambientes) {
        const unid = unidades.find(u => u.id === amb.unidade_id)
        const pav = unid ? pavimentos.find(p => p.id === unid.pavimento_id) : null
        if (!unid || !pav) continue
        execucoes.push({ checklist_id: id!, item_id: item.id, pavimento_id: pav.id, unidade_id: unid.id, ambiente_id: amb.id, status: 'pendente' })
      }
    }

    for (let i = 0; i < execucoes.length; i += 500) {
      const { error } = await supabase.from('checklist_execucoes').insert(execucoes.slice(i, i + 500))
      if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
        toast({ variant: 'destructive', title: 'Erro ao ativar checklist', description: error.message })
        setActivating(false)
        return
      }
    }

    await supabase.from('checklists').update({ status: 'ativo' }).eq('id', id!)
    toast({ title: `Checklist ativado! ${execucoes.length} verificações criadas.` })
    loadData()
    setActivating(false)
  }

  const unidadesDoPav = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)
  const ambientesDaUnid = (unidId: string) => ambientes.filter(a => a.unidade_id === unidId)

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!checklist) return <div className="text-center py-16 text-muted-foreground">Checklist não encontrado.</div>

  const isAtivo = checklist.status === 'ativo'
  const totalVerif = calcVerificacoes()

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link to="/checklists"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold truncate">{checklist.nome}</h2>
          <p className="text-sm text-muted-foreground mt-1">{checklist.obras?.nome}</p>
          {checklist.descricao && <p className="text-sm text-muted-foreground mt-1">{checklist.descricao}</p>}
        </div>
        <Badge variant={isAtivo ? 'success' : checklist.status === 'concluido' ? 'secondary' : 'outline'}>
          {isAtivo ? 'Ativo' : checklist.status === 'concluido' ? 'Concluído' : 'Rascunho'}
        </Badge>
      </div>

      {/* Items Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" />
            Itens de Verificação ({itens.length})
          </CardTitle>
          {isAtivo && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Ativo — edições afetam novas ativações
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum item adicionado.</p>
          ) : (
            <div className="space-y-4">
              {(['pavimento', 'unidade', 'ambiente'] as ItemScope[]).map(scope => {
                const scopeItems = itensPorScope(scope)
                if (scopeItems.length === 0) return null
                const Icon = scopeIcon[scope]
                return (
                  <div key={scope}>
                    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded px-2 py-0.5 mb-2 ${scopeBadgeClass[scope]}`}>
                      <Icon className="h-3 w-3" />{scopeLabel[scope]}
                    </div>
                    <div className="space-y-1.5">
                      {scopeItems.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-white">
                          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{idx + 1}.</span>
                          <span className="flex-1 text-sm">{item.nome}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Separator />

          {/* Add item form */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={novoScope} onValueChange={v => setNovoScope(v as ItemScope)}>
                <SelectTrigger className="w-44 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['unidade', 'pavimento', 'ambiente'] as ItemScope[]).map(s => (
                    <SelectItem key={s} value={s}>{scopeLabel[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={novoItem}
                onChange={e => setNovoItem(e.target.value)}
                placeholder="Ex: Tomada instalada e funcionando"
                onKeyDown={e => { if (e.key === 'Enter') addItem() }}
              />
              <Button onClick={addItem} disabled={addingItem || !novoItem.trim()}>
                {addingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{scopeDesc[novoScope]} · Enter para adicionar</p>
          </div>
        </CardContent>
      </Card>

      {/* Estrutura da obra */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5" />
            Estrutura da Obra
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pavimentos.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              A obra não possui pavimentos cadastrados.{' '}
              <Link to={`/obras/${(checklist as { obra_id: string }).obra_id}`} className="underline">Cadastrar agora</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pavimentos.map(pav => {
                const pavUnids = unidadesDoPav(pav.id)
                return (
                  <div key={pav.id}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      {pav.nome} — {pavUnids.length} unidades
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pavUnids.map(u => {
                        const ambs = ambientesDaUnid(u.id)
                        return (
                          <span key={u.id} className="text-xs bg-muted px-2 py-1 rounded">
                            {u.nome}{ambs.length > 0 ? ` (${ambs.length})` : ''}
                          </span>
                        )
                      })}
                      {pavUnids.length === 0 && <span className="text-xs text-muted-foreground italic">Sem unidades</span>}
                    </div>
                  </div>
                )
              })}

              <div className="pt-2 border-t text-xs text-muted-foreground space-y-0.5">
                {itensPorScope('pavimento').length > 0 && (
                  <p className="flex items-center gap-1">
                    <Layers className="h-3 w-3 text-blue-600" />
                    {itensPorScope('pavimento').length} itens × {pavimentos.length} pavimentos = <strong>{itensPorScope('pavimento').length * pavimentos.length}</strong> verificações
                  </p>
                )}
                {itensPorScope('unidade').length > 0 && (
                  <p className="flex items-center gap-1">
                    <Home className="h-3 w-3 text-green-600" />
                    {itensPorScope('unidade').length} itens × {unidades.length} unidades = <strong>{itensPorScope('unidade').length * unidades.length}</strong> verificações
                  </p>
                )}
                {itensPorScope('ambiente').length > 0 && (
                  <p className="flex items-center gap-1">
                    <Grid3x3 className="h-3 w-3 text-purple-600" />
                    {itensPorScope('ambiente').length} itens × {ambientes.length} ambientes = <strong>{itensPorScope('ambiente').length * ambientes.length}</strong> verificações
                  </p>
                )}
                <p className="font-semibold text-foreground pt-1">Total: {totalVerif} verificações</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {checklist.status === 'rascunho' && (
        <div className="flex gap-3 items-center">
          <Button onClick={ativarChecklist} disabled={activating || itens.length === 0} className="gap-2">
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Ativar Checklist
          </Button>
          <p className="text-sm text-muted-foreground">
            {totalVerif > 0 ? `${totalVerif} verificações serão criadas.` : 'Adicione itens para calcular.'}
          </p>
        </div>
      )}

      {isAtivo && (
        <div className="flex gap-3">
          <Button asChild className="gap-2">
            <Link to={`/checklists/${id}/executar`}>
              <Play className="h-4 w-4" />Executar Checklist
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/checklists/${id}/relatorio`}>Ver Relatório</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
