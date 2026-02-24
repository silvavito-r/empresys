import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente, ClienteInsert } from '@/types/database'
import { logAction } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Building2, Pencil, Trash2, Loader2, Search,
  MapPin, Phone, Mail, User, ImagePlus, X,
} from 'lucide-react'
import { formatCNPJ } from '@/lib/utils'

type ClienteForm = {
  nome: string
  cnpj: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  contato_nome: string
  contato_telefone: string
  contato_email: string
  descricao: string
}

const emptyForm: ClienteForm = {
  nome: '', cnpj: '', rua: '', numero: '', bairro: '',
  cidade: '', uf: '', cep: '', contato_nome: '',
  contato_telefone: '', contato_email: '', descricao: '',
}

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [form, setForm] = useState<ClienteForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Detail modal
  const [detailCliente, setDetailCliente] = useState<Cliente | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    setForm(emptyForm)
    setLogoFile(null)
    setLogoPreview(null)
    setFormOpen(true)
  }

  const openEdit = (cliente: Cliente, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingCliente(cliente)
    setForm({
      nome: cliente.nome,
      cnpj: cliente.cnpj ?? '',
      rua: cliente.rua ?? '',
      numero: cliente.numero ?? '',
      bairro: cliente.bairro ?? '',
      cidade: cliente.cidade ?? '',
      uf: cliente.uf ?? '',
      cep: cliente.cep ?? '',
      contato_nome: cliente.contato_nome ?? '',
      contato_telefone: cliente.contato_telefone ?? '',
      contato_email: cliente.contato_email ?? '',
      descricao: cliente.descricao ?? '',
    })
    setLogoFile(null)
    setLogoPreview(cliente.logo_url)
    setFormOpen(true)
    setDetailOpen(false)
  }

  const openDetail = (cliente: Cliente) => {
    setDetailCliente(cliente)
    setDetailOpen(true)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const uploadLogo = async (clienteId: string): Promise<string | null> => {
    if (!logoFile) return null
    try {
      const ext = logoFile.name.split('.').pop() ?? 'png'
      const path = `${clienteId}/logo.${ext}`
      const { error } = await supabase.storage
        .from('logos-clientes')
        .upload(path, logoFile, { upsert: true })
      if (error) {
        console.error('Logo upload error:', error)
        toast({
          variant: 'destructive',
          title: 'Erro ao enviar logo',
          description: error.message,
        })
        return null
      }
      const { data } = supabase.storage.from('logos-clientes').getPublicUrl(path)
      return data.publicUrl
    } catch (e) {
      console.error('Logo upload exception:', e)
      toast({ variant: 'destructive', title: 'Erro ao enviar logo', description: String(e) })
      return null
    }
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' })
      return
    }
    setSaving(true)
    try {
      const basePayload: ClienteInsert = {
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || null,
        rua: form.rua.trim() || null,
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        cep: form.cep.trim() || null,
        contato_nome: form.contato_nome.trim() || null,
        contato_telefone: form.contato_telefone.trim() || null,
        contato_email: form.contato_email.trim() || null,
        descricao: form.descricao.trim() || null,
      }

      if (editingCliente) {
        // Calcula logo_url: mantém a existente por padrão
        let logo_url = editingCliente.logo_url
        if (logoFile) {
          // Novo arquivo selecionado: tenta upload
          const uploaded = await uploadLogo(editingCliente.id)
          if (uploaded) logo_url = uploaded
          // se falhou, uploadLogo já exibiu o toast com o erro específico
        } else if (logoPreview === null) {
          // Usuário clicou em remover a logo
          logo_url = null
        }

        const { error } = await supabase
          .from('clientes')
          .update({ ...basePayload, logo_url })
          .eq('id', editingCliente.id)

        if (error) {
          toast({ variant: 'destructive', title: 'Erro ao atualizar cliente' })
        } else {
          toast({ title: 'Cliente atualizado' })
          await logAction('cliente_atualizado', { nome: form.nome })
          setFormOpen(false)
          loadClientes()
        }
      } else {
        const { data: newCliente, error } = await supabase
          .from('clientes')
          .insert(basePayload)
          .select()
          .single()

        if (error || !newCliente) {
          toast({ variant: 'destructive', title: 'Erro ao cadastrar cliente' })
        } else {
          // Upload logo após criar (precisa do ID gerado)
          if (logoFile) {
            const logo_url = await uploadLogo(newCliente.id)
            if (logo_url) {
              await supabase.from('clientes').update({ logo_url }).eq('id', newCliente.id)
            }
            // se falhou, uploadLogo já exibiu o toast com o erro específico
          }
          toast({ title: 'Cliente cadastrado' })
          await logAction('cliente_cadastrado', { nome: form.nome })
          setFormOpen(false)
          loadClientes()
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
    const { error } = await supabase.from('clientes').delete().eq('id', deleteTarget.id)
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir cliente' })
    } else {
      toast({ title: 'Cliente excluído' })
      await logAction('cliente_excluido', { nome: deleteTarget.nome })
      setDetailOpen(false)
    }
    setDeleting(false)
    setDeleteTarget(null)
    loadClientes()
  }

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.cnpj ?? '').includes(search)
  )

  const formatEndereco = (c: Cliente) => {
    const parts = [c.rua, c.numero, c.bairro, c.cidade, c.uf].filter(Boolean)
    return parts.join(', ')
  }

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
            <Card
              key={cliente.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openDetail(cliente)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Logo or icon */}
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 overflow-hidden border">
                    {cliente.logo_url ? (
                      <img src={cliente.logo_url} alt={cliente.nome} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="h-6 w-6 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight truncate">{cliente.nome}</p>
                    {cliente.cnpj && (
                      <p className="text-xs text-muted-foreground mt-0.5">{formatCNPJ(cliente.cnpj)}</p>
                    )}
                    {formatEndereco(cliente) && (
                      <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {formatEndereco(cliente)}
                      </p>
                    )}
                    {cliente.contato_telefone && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {cliente.contato_telefone}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Detail Modal ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {detailCliente?.logo_url ? (
                <img src={detailCliente.logo_url} alt="" className="w-10 h-10 object-contain rounded border" />
              ) : (
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
              )}
              {detailCliente?.nome}
            </DialogTitle>
          </DialogHeader>
          {detailCliente && (
            <div className="space-y-4 py-1">
              {detailCliente.cnpj && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">CNPJ</p>
                  <p className="text-sm">{formatCNPJ(detailCliente.cnpj)}</p>
                </div>
              )}

              {(detailCliente.rua || detailCliente.cidade) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Endereço
                  </p>
                  <p className="text-sm">
                    {[detailCliente.rua, detailCliente.numero].filter(Boolean).join(', ')}
                    {detailCliente.bairro && <>, {detailCliente.bairro}</>}
                  </p>
                  <p className="text-sm">
                    {[detailCliente.cidade, detailCliente.uf].filter(Boolean).join(' — ')}
                    {detailCliente.cep && <> · CEP {detailCliente.cep}</>}
                  </p>
                </div>
              )}

              {(detailCliente.contato_nome || detailCliente.contato_telefone || detailCliente.contato_email) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
                      <User className="h-3 w-3" /> Contato
                    </p>
                    {detailCliente.contato_nome && <p className="text-sm font-medium">{detailCliente.contato_nome}</p>}
                    {detailCliente.contato_telefone && (
                      <p className="text-sm flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> {detailCliente.contato_telefone}
                      </p>
                    )}
                    {detailCliente.contato_email && (
                      <p className="text-sm flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" /> {detailCliente.contato_email}
                      </p>
                    )}
                  </div>
                </>
              )}

              {detailCliente.descricao && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{detailCliente.descricao}</p>
                </>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive hover:bg-destructive hover:text-white"
              onClick={() => setDeleteTarget(detailCliente)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
            <Button size="sm" onClick={(e) => openEdit(detailCliente!, e)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit Form ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">

            {/* Logo upload */}
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden bg-muted/20"
                onClick={() => fileRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  {logoPreview ? 'Trocar logo' : 'Adicionar logo'}
                </Button>
                {logoPreview && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 text-muted-foreground"
                    onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG até 2 MB</p>
              </div>
            </div>

            <Separator />

            {/* Nome e CNPJ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome da Construtora *</Label>
                <Input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Construtora ABC Ltda"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Input
                  value={form.cnpj}
                  onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5 mb-3 text-muted-foreground">
                <MapPin className="h-4 w-4" /> Endereço <span className="text-xs">(opcional)</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Rua / Avenida</Label>
                  <Input value={form.rua} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))} placeholder="Av. Brasil" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número</Label>
                  <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="1000" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Centro" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CEP</Label>
                  <Input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} placeholder="00000-000" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Balneário Camboriú" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">UF</Label>
                  <Input value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} placeholder="SC" maxLength={2} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Contato */}
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5 mb-3 text-muted-foreground">
                <User className="h-4 w-4" /> Contato <span className="text-xs">(opcional)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Nome do Contato</Label>
                  <Input value={form.contato_nome} onChange={e => setForm(f => ({ ...f, contato_nome: e.target.value }))} placeholder="João Silva" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={form.contato_telefone} onChange={e => setForm(f => ({ ...f, contato_telefone: e.target.value }))} placeholder="(47) 99999-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input value={form.contato_email} onChange={e => setForm(f => ({ ...f, contato_email: e.target.value }))} placeholder="joao@construtora.com" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label>Descrição <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Observações sobre a construtora..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCliente ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá <strong>{deleteTarget?.nome}</strong> e todas as obras associadas. Essa ação não pode ser desfeita.
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
