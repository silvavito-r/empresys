import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ChecklistComObra, ChecklistInsert, Obra } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Plus, ClipboardList, Search, ArrowRight, Loader2, Play } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const statusVariant = {
  rascunho: 'outline',
  ativo: 'success',
  concluido: 'secondary',
} as const

const statusLabel = { rascunho: 'Rascunho', ativo: 'Ativo', concluido: 'Concluído' }

interface ExecSummary { total: number; done: number }

export function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistComObra[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, ExecSummary>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ChecklistInsert>({ obra_id: '', nome: '', descricao: '', status: 'rascunho' })
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    const [{ data: cls }, { data: obs }, { data: execs }] = await Promise.all([
      supabase.from('checklists').select('*, obras(nome, cliente_id)').order('created_at', { ascending: false }),
      supabase.from('obras').select('*').eq('status', 'ativa').order('nome'),
      supabase.from('checklist_execucoes').select('checklist_id, status'),
    ])

    setChecklists((cls as ChecklistComObra[]) ?? [])
    setObras(obs ?? [])

    // Build progress map per checklist
    const map: Record<string, ExecSummary> = {}
    ;(execs ?? []).forEach((e: { checklist_id: string; status: string }) => {
      if (!map[e.checklist_id]) map[e.checklist_id] = { total: 0, done: 0 }
      map[e.checklist_id].total++
      if (e.status !== 'pendente') map[e.checklist_id].done++
    })
    setProgressMap(map)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async () => {
    if (!form.obra_id) { toast({ variant: 'destructive', title: 'Selecione a obra' }); return }
    if (!form.nome?.trim()) { toast({ variant: 'destructive', title: 'Nome obrigatório' }); return }
    setSaving(true)
    const { error } = await supabase.from('checklists').insert({
      obra_id: form.obra_id,
      nome: form.nome.trim(),
      descricao: form.descricao?.trim() || null,
      status: 'rascunho',
    })
    if (error) { toast({ variant: 'destructive', title: 'Erro ao criar checklist' }) }
    else { toast({ title: 'Checklist criado' }); setDialogOpen(false); loadData() }
    setSaving(false)
  }

  const filtered = checklists.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.obras?.nome ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar checklists..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setForm({ obra_id: '', nome: '', descricao: '', status: 'rascunho' }); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Checklist
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <ClipboardList className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">{search ? 'Nenhum checklist encontrado' : 'Nenhum checklist cadastrado'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(cl => {
            const prog = progressMap[cl.id]
            const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : null

            return (
              <Card key={cl.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight truncate">{cl.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{cl.obras?.nome ?? '—'}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cl.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{cl.descricao}</p>}

                  {pct !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{prog!.done}/{prog!.total} verificações</span>
                        <span className="font-semibold text-primary">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">{formatDateTime(cl.created_at)}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant={statusVariant[cl.status] ?? 'outline'}>{statusLabel[cl.status] ?? cl.status}</Badge>
                    <div className="flex gap-1">
                      {cl.status === 'ativo' && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/checklists/${cl.id}/executar`}>
                            <Play className="h-3 w-3 mr-1" />Executar
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/checklists/${cl.id}`}>
                          Detalhe <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Checklist</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Obra *</Label>
              <Select value={form.obra_id} onValueChange={v => setForm(f => ({ ...f, obra_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                <SelectContent>
                  {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Checklist *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Verificação dos Acabamentos Elétricos" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea value={form.descricao ?? ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o objetivo deste checklist..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
