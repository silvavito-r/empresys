import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import type { Cliente, ObraComCliente, ObraInsert } from "@/types/database"
import { logAction } from "@/lib/logger"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Plus, HardHat, Pencil, Trash2, Loader2, Search,
  ArrowRight, MapPin, Filter, X,
} from "lucide-react"

const statusOptions = [
  { value: "ativa", label: "Ativa" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluida" },
]

const statusBadgeVariant = {
  ativa: "success",
  pausada: "warning",
  concluida: "secondary",
} as const

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]

type ObraForm = {
  nome: string
  cliente_id: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  regiao: string
  responsavel: string
  status: "ativa" | "pausada" | "concluida"
}

const emptyForm: ObraForm = {
  nome: '', cliente_id: '', rua: '', numero: '', bairro: '',
  cidade: '', uf: 'SC', cep: '', regiao: '', responsavel: '', status: 'ativa',
}

export function ObrasPage() {
  const [obras, setObras] = useState<ObraComCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [filterStatus, setFilterStatus] = useState('')
  const [filterCliente, setFilterCliente] = useState('')
  const [filterRegiao, setFilterRegiao] = useState('')
  const [regioes, setRegioes] = useState<string[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editingObra, setEditingObra] = useState<ObraComCliente | null>(null)
  const [form, setForm] = useState<ObraForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ObraComCliente | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    const [{ data: obrasData }, { data: clientesData }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nome, logo_url)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    const list = (obrasData as ObraComCliente[]) ?? []
    setObras(list)
    setClientes(clientesData ?? [])
    const r = Array.from(new Set(list.map(o => o.regiao).filter(Boolean))) as string[]
    setRegioes(r.sort())
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openCreate = () => {
    setEditingObra(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (obra: ObraComCliente) => {
    setEditingObra(obra)
    setForm({
      nome: obra.nome,
      cliente_id: obra.cliente_id ?? '',
      rua: obra.rua ?? '',
      numero: obra.numero ?? '',
      bairro: obra.bairro ?? '',
      cidade: obra.cidade ?? '',
      uf: obra.uf ?? 'SC',
      cep: obra.cep ?? '',
      regiao: obra.regiao ?? '',
      responsavel: obra.responsavel ?? '',
      status: obra.status,
    })
    setFormOpen(true)
  }

  const validate = () => {
    if (!form.nome.trim()) { toast({ variant: 'destructive', title: 'Nome obrigatório' }); return false }
    if (!form.cliente_id) { toast({ variant: 'destructive', title: 'Construtora obrigatória' }); return false }
    if (!form.rua.trim()) { toast({ variant: 'destructive', title: 'Rua obrigatória' }); return false }
    if (!form.numero.trim()) { toast({ variant: 'destructive', title: 'Número obrigatório' }); return false }
    if (!form.bairro.trim()) { toast({ variant: 'destructive', title: 'Bairro obrigatório' }); return false }
    if (!form.cidade.trim()) { toast({ variant: 'destructive', title: 'Cidade obrigatória' }); return false }
    if (!form.uf) { toast({ variant: 'destructive', title: 'UF obrigatória' }); return false }
    if (!form.cep.trim()) { toast({ variant: 'destructive', title: 'CEP obrigatório' }); return false }
    if (!form.regiao.trim()) { toast({ variant: 'destructive', title: 'Região obrigatória' }); return false }
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload: ObraInsert = {
        nome: form.nome.trim(),
        cliente_id: form.cliente_id || null,
        rua: form.rua.trim(),
        numero: form.numero.trim(),
        bairro: form.bairro.trim(),
        cidade: form.cidade.trim(),
        uf: form.uf.toUpperCase(),
        cep: form.cep.trim(),
        regiao: form.regiao.trim(),
        responsavel: form.responsavel.trim() || null,
        status: form.status,
      }
      if (editingObra) {
        const { error } = await supabase.from('obras').update(payload).eq('id', editingObra.id)
        if (error) { toast({ variant: 'destructive', title: 'Erro ao atualizar' }) }
        else {
          toast({ title: 'Obra atualizada' })
          await logAction('obra_atualizada', { nome: form.nome })
          setFormOpen(false)
          loadData()
        }
      } else {
        const { error } = await supabase.from('obras').insert(payload)
        if (error) { toast({ variant: 'destructive', title: 'Erro ao cadastrar' }) }
        else {
          toast({ title: 'Obra cadastrada' })
          await logAction('obra_cadastrada', { nome: form.nome })
          setFormOpen(false)
          loadData()
        }
      }
    } catch (e) {
      console.error('handleSave error:', e)
      toast({ variant: 'destructive', title: 'Erro inesperado. Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('obras').delete().eq('id', deleteTarget.id)
      if (error) { toast({ variant: 'destructive', title: 'Erro ao excluir' }) }
      else {
        toast({ title: 'Obra excluída' })
        await logAction('obra_excluida', { nome: deleteTarget.nome })
      }
    } catch (e) {
      console.error('handleDelete error:', e)
      toast({ variant: 'destructive', title: 'Erro inesperado ao excluir.' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
      loadData()
    }
  }

  const hasFilters = filterStatus || filterCliente || filterRegiao
  const clearFilters = () => { setFilterStatus(''); setFilterCliente(''); setFilterRegiao('') }

  const filtered = obras.filter(o => {
    const matchSearch =
      o.nome.toLowerCase().includes(search.toLowerCase()) ||
      (o.clientes?.nome ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || o.status === filterStatus
    const matchCliente = !filterCliente || o.cliente_id === filterCliente
    const matchRegiao = !filterRegiao || o.regiao === filterRegiao
    return matchSearch && matchStatus && matchCliente && matchRegiao
  })

  const formatEndereco = (o: ObraComCliente) => {
    const street = [o.rua, o.numero, o.bairro].filter(Boolean).join(', ')
    const city = [o.cidade, o.uf].filter(Boolean).join(' - ')
    if (!street && !city) return o.endereco ?? ''
    return [street, city].filter(Boolean).join(' · ')
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar obras..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterStatus || '__all__'} onValueChange={v => setFilterStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className={`w-36 ${filterStatus ? 'border-primary text-primary' : ''}`}>
            <Filter className="h-3.5 w-3.5 mr-1.5 opacity-60" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterCliente || '__all__'} onValueChange={v => setFilterCliente(v === '__all__' ? '' : v)}>
          <SelectTrigger className={`w-44 ${filterCliente ? 'border-primary text-primary' : ''}`}>
            <Filter className="h-3.5 w-3.5 mr-1.5 opacity-60" />
            <SelectValue placeholder="Construtora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as construtoras</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        {regioes.length > 0 && (
          <Select value={filterRegiao || '__all__'} onValueChange={v => setFilterRegiao(v === '__all__' ? '' : v)}>
            <SelectTrigger className={`w-40 ${filterRegiao ? 'border-primary text-primary' : ''}`}>
              <Filter className="h-3.5 w-3.5 mr-1.5 opacity-60" />
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as regiões</SelectItem>
              {regioes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}

        <Button onClick={openCreate} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" /> Nova Obra
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <HardHat className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">
              {search || hasFilters ? 'Nenhuma obra encontrada' : 'Nenhuma obra cadastrada'}
            </p>
            {!search && !hasFilters && (
              <Button onClick={openCreate} variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar primeira obra
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(obra => (
            <Card key={obra.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden border border-orange-200">
                      {obra.clientes?.logo_url ? (
                        <img src={obra.clientes.logo_url} alt={obra.clientes.nome} className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <HardHat className="h-5 w-5 text-orange-600" />
                      )}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(obra)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm text-muted-foreground">
                  {obra.responsavel && <p>Resp.: {obra.responsavel}</p>}
                  {formatEndereco(obra) && (
                    <p className="truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {formatEndereco(obra)}
                    </p>
                  )}
                  {obra.regiao && (
                    <span className="inline-block bg-orange-50 text-orange-700 rounded px-1.5 py-0.5 text-xs">
                      {obra.regiao}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={statusBadgeVariant[obra.status] ?? 'outline'}>
                    {statusOptions.find(s => s.value === obra.status)?.label ?? obra.status}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/obras/${obra.id}`}>
                      Estrutura <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingObra ? 'Editar Obra' : 'Nova Obra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome da Obra *</Label>
                <Input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Residencial Atlântico"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Construtora *</Label>
                <Select value={form.cliente_id} onValueChange={v => setForm(f => ({ ...f, cliente_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a construtora" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium flex items-center gap-1.5 mb-3 text-muted-foreground">
                <MapPin className="h-4 w-4" /> Endereço da Obra *
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Rua / Avenida *</Label>
                  <Input value={form.rua} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))} placeholder="Av. Brasil" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número *</Label>
                  <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="1000" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Bairro *</Label>
                  <Input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Centro" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CEP *</Label>
                  <Input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} placeholder="00000-000" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Cidade *</Label>
                  <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Balneário Camboriú" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">UF *</Label>
                  <Select value={form.uf} onValueChange={v => setForm(f => ({ ...f, uf: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Região *</Label>
                <Input
                  value={form.regiao}
                  onChange={e => setForm(f => ({ ...f, regiao: e.target.value }))}
                  placeholder="Ex: Litoral Norte"
                  list="regioes-list"
                />
                <datalist id="regioes-list">
                  {regioes.map(r => <option key={r} value={r} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm(f => ({ ...f, status: v as ObraForm['status'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Responsável Técnico <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Input
                  value={form.responsavel}
                  onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                  placeholder="Eng. / Encarregado"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingObra ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obra?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá <strong>{deleteTarget?.nome}</strong> e todos os dados associados (pavimentos, unidades, checklists). Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}