import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Checklist, ChecklistItem, Pavimento, Unidade } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, Plus, Trash2, Loader2, Play, GripVertical,
  ClipboardList, CheckCircle2, AlertCircle,
} from 'lucide-react'

export function ChecklistDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [checklist, setChecklist] = useState<Checklist & { obras: { nome: string } | null } | null>(null)
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(true)
  const [novoItem, setNovoItem] = useState('')
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

    const [{ data: items }, { data: pavs }] = await Promise.all([
      supabase.from('checklist_itens').select('*').eq('checklist_id', id).order('ordem'),
      supabase.from('pavimentos').select('*').eq('obra_id', (cl as { obra_id: string }).obra_id).order('ordem'),
    ])

    setItens(items ?? [])
    const pavList = pavs ?? []
    setPavimentos(pavList)

    if (pavList.length > 0) {
      const pavIds = pavList.map(p => p.id)
      const { data: unids } = await supabase.from('unidades').select('*').in('pavimento_id', pavIds).order('ordem')
      setUnidades(unids ?? [])
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
    })
    if (error) { toast({ variant: 'destructive', title: 'Erro ao adicionar item' }) }
    else { setNovoItem(''); loadData() }
    setAddingItem(false)
  }

  const removeItem = async (itemId: string) => {
    await supabase.from('checklist_itens').delete().eq('id', itemId)
    loadData()
  }

  const ativarChecklist = async () => {
    if (itens.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione pelo menos um item antes de ativar' })
      return
    }
    if (unidades.length === 0) {
      toast({ variant: 'destructive', title: 'A obra não possui unidades cadastradas' })
      return
    }

    // Criar todas as execuções (item × unidade)
    const execucoes = []
    for (const item of itens) {
      for (const unid of unidades) {
        const pav = pavimentos.find(p => p.id === unid.pavimento_id)
        if (!pav) continue
        execucoes.push({
          checklist_id: id!,
          item_id: item.id,
          pavimento_id: pav.id,
          unidade_id: unid.id,
          status: 'pendente' as const,
        })
      }
    }

    // Insert em lotes de 500
    for (let i = 0; i < execucoes.length; i += 500) {
      const { error } = await supabase.from('checklist_execucoes').insert(execucoes.slice(i, i + 500))
      if (error) {
        // Ignore duplicate key errors (already activated)
        if (!error.message.includes('duplicate')) {
          toast({ variant: 'destructive', title: 'Erro ao ativar checklist' })
          return
        }
      }
    }

    await supabase.from('checklists').update({ status: 'ativo' }).eq('id', id!)
    toast({ title: `Checklist ativado! ${execucoes.length} verificações criadas.` })
    loadData()
  }

  const unidadesDoPav = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!checklist) return <div className="text-center py-16 text-muted-foreground">Checklist não encontrado.</div>

  const isRascunho = checklist.status === 'rascunho'

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
        <Badge variant={checklist.status === 'ativo' ? 'success' : checklist.status === 'concluido' ? 'secondary' : 'outline'}>
          {checklist.status === 'ativo' ? 'Ativo' : checklist.status === 'concluido' ? 'Concluído' : 'Rascunho'}
        </Badge>
      </div>

      {/* Items Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Itens de Verificação ({itens.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum item adicionado. Adicione os itens que serão verificados na obra.
            </p>
          ) : (
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-white">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{idx + 1}.</span>
                  <span className="flex-1 text-sm">{item.nome}</span>
                  {isRascunho && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isRascunho && (
            <>
              <Separator />
              <div className="flex gap-2">
                <Input
                  value={novoItem}
                  onChange={e => setNovoItem(e.target.value)}
                  placeholder="Ex: Suportes e módulos instalados"
                  onKeyDown={e => { if (e.key === 'Enter') addItem() }}
                />
                <Button onClick={addItem} disabled={addingItem || !novoItem.trim()}>
                  {addingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Pressione Enter ou clique + para adicionar</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Estrutura da obra */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Estrutura da Obra ({unidades.length} unidades)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada item será verificado em todas as unidades abaixo.
          </p>
        </CardHeader>
        <CardContent>
          {pavimentos.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              A obra não possui pavimentos/unidades cadastrados.{' '}
              <Link to={`/obras/${(checklist as { obra_id: string }).obra_id}`} className="underline">Cadastrar agora</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pavimentos.map(pav => {
                const pavUnids = unidadesDoPav(pav.id)
                return (
                  <div key={pav.id}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{pav.nome} ({pavUnids.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pavUnids.map(u => (
                        <span key={u.id} className="text-xs bg-muted px-2 py-1 rounded">{u.nome}</span>
                      ))}
                      {pavUnids.length === 0 && <span className="text-xs text-muted-foreground italic">Sem unidades</span>}
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-muted-foreground pt-2">
                Total: {itens.length} itens × {unidades.length} unidades = {itens.length * unidades.length} verificações
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {isRascunho && (
        <div className="flex gap-3">
          <Button onClick={ativarChecklist} disabled={itens.length === 0 || unidades.length === 0} className="gap-2">
            <Play className="h-4 w-4" />
            Ativar Checklist
          </Button>
          <p className="text-sm text-muted-foreground self-center">
            Ao ativar, serão criadas todas as verificações e o checklist estará pronto para uso na obra.
          </p>
        </div>
      )}

      {checklist.status === 'ativo' && (
        <div className="flex gap-3">
          <Button asChild className="gap-2">
            <Link to={`/checklists/${id}/executar`}>
              <Play className="h-4 w-4" />
              Executar Checklist
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/checklists/${id}/relatorio`}>
              Ver Relatório
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
