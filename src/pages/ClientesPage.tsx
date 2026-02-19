import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente, ClienteInsert } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Building2, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { formatCNPJ } from '@/lib/utils'

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ClienteInsert>({ nome: '', cnpj: '', endereco: '' })
  const { toast } = useToast()

  const loadClientes = async () => {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nome')
    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadClientes() }, [])

  const openCreate = () => {
    setEditingCliente(null)
    setForm({ nome: '', cnpj: '', endereco: '' })
    setDialogOpen(true)
  }

  const openEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setForm({ nome: cliente.nome, cnpj: cliente.cnpj ?? '', endereco: cliente.endereco ?? '' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' })
      return
    }
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj?.trim() || null,
      endereco: form.endereco?.trim() || null,
    }

    if (editingCliente) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', editingCliente.id)
      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao atualizar cliente' })
      } else {
        toast({ title: 'Cliente atualizado com sucesso' })
        setDialogOpen(false)
        loadClientes()
      }
    } else {
      const { error } = await supabase.from('clientes').insert(payload)
      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao cadastrar cliente' })
      } else {
        toast({ title: 'Cliente cadastrado com sucesso' })
        setDialogOpen(false)
        loadClientes()
      }
    }
    setSaving(false)
  }

  const handleDelete = async (cliente: Cliente) => {
    if (!confirm(`Deseja excluir o cliente "${cliente.nome}"? Isso também excluirá todas as obras associadas.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id)
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir cliente' })
    } else {
      toast({ title: 'Cliente excluído' })
      loadClientes()
    }
  }

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.cnpj ?? '').includes(search)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Building2 className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">
              {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
            {!search && (
              <Button onClick={openCreate} variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar primeiro cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(cliente => (
            <Card key={cliente.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-base leading-tight">{cliente.nome}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cliente)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(cliente)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {cliente.cnpj && <p>CNPJ: {formatCNPJ(cliente.cnpj)}</p>}
                {cliente.endereco && <p className="truncate">{cliente.endereco}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Construtora *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Construtora ABC Ltda"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                id="cnpj"
                value={form.cnpj ?? ''}
                onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                id="endereco"
                value={form.endereco ?? ''}
                onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                placeholder="Rua, número, bairro..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCliente ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
