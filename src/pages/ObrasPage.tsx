import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Cliente, ObraComCliente, ObraInsert } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, HardHat, Pencil, Trash2, Loader2, Search, ArrowRight } from 'lucide-react'

const statusOptions = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'concluida', label: 'Concluída' },
]

const statusBadgeVariant = {
  ativa: 'success',
  pausada: 'warning',
  concluida: 'secondary',
} as const

export function ObrasPage() {
  const [obras, setObras] = useState<ObraComCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingObra, setEditingObra] = useState<ObraComCliente | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ObraInsert>({ nome: '', cliente_id: '', endereco: '', responsavel: '', status: 'ativa' })
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    const [{ data: obras }, { data: clientes }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nome)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setObras((obras as ObraComCliente[]) ?? [])
    setClientes(clientes ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openCreate = () => {
    setEditingObra(null)
    setForm({ nome: '', cliente_id: '', endereco: '', responsavel: '', status: 'ativa' })
    setDialogOpen(true)
  }

  const openEdit = (obra: ObraComCliente) => {
    setEditingObra(obra)
    setForm({
      nome: obra.nome,
      cliente_id: obra.cliente_id ?? '',
      endereco: obra.endereco ?? '',
      responsavel: obra.responsavel ?? '',
      status: obra.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast({ variant: 'destructive', title: 'Nome obrigatório' }); return }
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      cliente_id: form.cliente_id || null,
      endereco: form.endereco?.trim() || null,
      responsavel: form.responsavel?.trim() || null,
      status: form.status ?? 'ativa',
    }

    if (editingObra) {
      const { error } = await supabase.from('obras').update(payload).eq('id', editingObra.id)
      if (error) { toast({ variant: 'destructive', title: 'Erro ao atualizar' }) }
      else { toast({ title: 'Obra atualizada' }); setDialogOpen(false); loadData() }
    } else {
      const { error } = await supabase.from('obras').insert(payload)
      if (error) { toast({ variant: 'destructive', title: 'Erro ao cadastrar' }) }
      else { toast({ title: 'Obra cadastrada' }); setDialogOpen(false); loadData() }
    }
    setSaving(false)
  }

  const handleDelete = async (obra: ObraComCliente) => {
    if (!confirm(`Excluir a obra "${obra.nome}"? Isso removerá todos os dados associados.`)) return
    const { error } = await supabase.from('obras').delete().eq('id', obra.id)
    if (error) { toast({ variant: 'destructive', title: 'Erro ao excluir' }) }
    else { toast({ title: 'Obra excluída' }); loadData() }
  }

  const filtered = obras.filter(o =>
    o.nome.toLowerCase().includes(search.toLowerCase()) ||
    (o.clientes?.nome ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar obras..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova Obra
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <HardHat className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">{search ? 'Nenhuma obra encontrada' : 'Nenhuma obra cadastrada'}</p>
            {!search && <Button onClick={openCreate} variant="outline"><Plus className="mr-2 h-4 w-4" />Cadastrar primeira obra</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(obra => (
            <Card key={obra.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <HardHat className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight truncate">{obra.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{obra.clientes?.nome ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(obra)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(obra)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm text-muted-foreground">
                  {obra.responsavel && <p>Resp.: {obra.responsavel}</p>}
                  {obra.endereco && <p className="truncate">{obra.endereco}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={statusBadgeVariant[obra.status] ?? 'outline'}>
                    {statusOptions.find(s => s.value === obra.status)?.label ?? obra.status}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/obras/${obra.id}`}>
                      Detalhe <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingObra ? 'Editar Obra' : 'Nova Obra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Obra *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Residencial Atlântico" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Construtora</Label>
              <Select value={form.cliente_id ?? ''} onValueChange={v => setForm(f => ({ ...f, cliente_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a construtora" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Endereço da Obra</Label>
              <Input value={form.endereco ?? ''} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro..." />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel ?? ''} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Eng. / Encarregado" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status ?? 'ativa'} onValueChange={v => setForm(f => ({ ...f, status: v as ObraInsert['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingObra ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
