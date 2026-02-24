import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { logAction } from '@/lib/logger'
import type { UserProfile, UserRole, SystemLog } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Users, ScrollText, Plus, Pencil, Trash2, Loader2,
  ShieldCheck, HardHat, UserRound, Clock,
} from 'lucide-react'
import { Navigate } from 'react-router-dom'

const ROLE_OPTIONS: { value: UserRole; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'administrador', label: 'Administrador', icon: ShieldCheck, color: 'text-red-600 bg-red-50' },
  { value: 'engenharia', label: 'Engenharia', icon: HardHat, color: 'text-blue-600 bg-blue-50' },
  { value: 'rh', label: 'RH', icon: UserRound, color: 'text-purple-600 bg-purple-50' },
]

function roleBadge(role: UserRole) {
  const opt = ROLE_OPTIONS.find(r => r.value === role)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${opt?.color ?? ''}`}>
      {opt?.label ?? role}
    </span>
  )
}

type UserForm = {
  nome: string
  email: string
  password: string
  role: UserRole
  descricao: string
}

const emptyUserForm: UserForm = { nome: '', email: '', password: '', role: 'engenharia', descricao: '' }

export function AdminPage() {
  const { role } = useAuth()

  // Guard: only admins
  if (role !== 'administrador') {
    return <Navigate to="/dashboard" replace />
  }

  return <AdminPageContent />
}

function AdminPageContent() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()

  // Users
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null)
  const [form, setForm] = useState<UserForm>(emptyUserForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Logs
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  const loadUsers = async () => {
    setLoadingUsers(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setProfiles(data ?? [])
    setLoadingUsers(false)
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    const { data } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data ?? [])
    setLoadingLogs(false)
  }

  useEffect(() => {
    loadUsers()
    loadLogs()
  }, [])

  const openCreate = () => {
    setEditingProfile(null)
    setForm(emptyUserForm)
    setFormOpen(true)
  }

  const openEdit = (profile: UserProfile) => {
    setEditingProfile(profile)
    setForm({ nome: profile.nome, email: profile.email ?? '', password: '', role: profile.role, descricao: profile.descricao ?? '' })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ variant: 'destructive', title: 'Nome obrigatório' }); return }
    if (!editingProfile && !form.email.trim()) { toast({ variant: 'destructive', title: 'E-mail obrigatório' }); return }
    if (!editingProfile && form.password.length < 6) { toast({ variant: 'destructive', title: 'Senha deve ter pelo menos 6 caracteres' }); return }

    setSaving(true)

    if (editingProfile) {
      // Alterar senha, se preenchida
      if (form.password.length > 0) {
        if (form.password.length < 6) {
          toast({ variant: 'destructive', title: 'Nova senha deve ter pelo menos 6 caracteres' })
          setSaving(false)
          return
        }
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string
        if (!serviceKey) {
          toast({ variant: 'destructive', title: 'Configure VITE_SUPABASE_SERVICE_ROLE_KEY no .env para alterar senhas' })
          setSaving(false)
          return
        }
        const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${editingProfile.user_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ password: form.password }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast({ variant: 'destructive', title: `Erro ao alterar senha: ${err.message ?? 'Tente novamente'}` })
          setSaving(false)
          return
        }
      }

      // Atualizar perfil
      const { error } = await supabase
        .from('profiles')
        .update({ nome: form.nome.trim(), role: form.role, descricao: form.descricao.trim() || null })
        .eq('id', editingProfile.id)

      if (error) { toast({ variant: 'destructive', title: 'Erro ao atualizar usuário' }) }
      else {
        const passwordMsg = form.password.length >= 6 ? ' e senha' : ''
        toast({ title: `Usuário atualizado${passwordMsg}` })
        await logAction('usuario_atualizado', { nome: form.nome, role: form.role })
        setFormOpen(false)
        loadUsers()
      }
    } else {
      // Cria via Admin API — não altera a sessão atual e confirma o e-mail automaticamente
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

      if (!serviceKey) {
        toast({ variant: 'destructive', title: 'Configure VITE_SUPABASE_SERVICE_ROLE_KEY no .env para criar usuários' })
        setSaving(false)
        return
      }

      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          email_confirm: true,   // confirma o e-mail imediatamente, sem link de verificação
        }),
      })

      const resBody = await res.json()

      if (!res.ok) {
        const msg = resBody?.msg ?? resBody?.message ?? 'Erro ao criar usuário'
        toast({ variant: 'destructive', title: msg })
        setSaving(false)
        return
      }

      const newUserId: string | undefined = resBody?.id

      if (!newUserId) {
        toast({ variant: 'destructive', title: 'Erro: resposta inesperada do servidor' })
        setSaving(false)
        return
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: newUserId,
        nome: form.nome.trim(),
        email: form.email.trim(),
        role: form.role,
        descricao: form.descricao.trim() || null,
        active: true,
      })

      if (profileError) {
        toast({ variant: 'destructive', title: 'Usuário criado, mas perfil não foi salvo. Recarregue e tente novamente.' })
      } else {
        toast({ title: 'Usuário criado com sucesso' })
        await logAction('usuario_criado', { email: form.email, role: form.role })
        setFormOpen(false)
        loadUsers()
      }
    }
    setSaving(false)
  }

  const handleDeactivate = async () => {
    if (!deleteTarget) return
    // Don't allow deleting yourself
    if (deleteTarget.user_id === currentUser?.id) {
      toast({ variant: 'destructive', title: 'Não é possível desativar sua própria conta' })
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    await supabase.from('profiles').update({ active: false }).eq('id', deleteTarget.id)
    toast({ title: 'Usuário desativado' })
    await logAction('usuario_desativado', { nome: deleteTarget.nome })
    setDeleting(false)
    setDeleteTarget(null)
    loadUsers()
  }

  const formatLogAction = (action: string) => {
    const labels: Record<string, string> = {
      cliente_cadastrado: 'Cliente cadastrado',
      cliente_atualizado: 'Cliente atualizado',
      cliente_excluido: 'Cliente excluído',
      obra_cadastrada: 'Obra cadastrada',
      obra_atualizada: 'Obra atualizada',
      obra_excluida: 'Obra excluída',
      usuario_criado: 'Usuário criado',
      usuario_atualizado: 'Usuário atualizado',
      usuario_desativado: 'Usuário desativado',
    }
    return labels[action] ?? action
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios"><Users className="h-4 w-4 mr-2" />Usuários</TabsTrigger>
          <TabsTrigger value="logs"><ScrollText className="h-4 w-4 mr-2" />Logs do Sistema</TabsTrigger>
        </TabsList>

        {/* ── Tab: Usuários ── */}
        <TabsContent value="usuarios" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Novo Usuário
            </Button>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map(profile => (
                <Card key={profile.id} className={`transition-opacity ${!profile.active ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-bold text-muted-foreground">
                          {profile.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{profile.nome}</p>
                            {!profile.active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                            {profile.user_id === currentUser?.id && <Badge variant="outline" className="text-xs">Você</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{profile.email}</p>
                          {profile.descricao && <p className="text-xs text-muted-foreground mt-0.5">{profile.descricao}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {roleBadge(profile.role)}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(profile)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {profile.user_id !== currentUser?.id && profile.active && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(profile)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Logs ── */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Atividade Recente ({logs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingLogs ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nenhum log registrado</p>
              ) : (
                <div className="divide-y">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{formatLogAction(log.action)}</p>
                        {log.details && typeof log.details === 'object' && !Array.isArray(log.details) && (
                          <p className="text-xs text-muted-foreground">
                            {Object.entries(log.details as Record<string, unknown>)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">{log.user_email ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: User Form ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
                autoFocus
              />
            </div>
            {!editingProfile && (
              <>
                <div className="space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="usuario@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha *</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </>
            )}
            {editingProfile && (
              <div className="space-y-1.5">
                <Label>
                  Nova Senha{' '}
                  <span className="text-xs font-normal text-muted-foreground">(deixe em branco para não alterar)</span>
                </Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nível de Acesso *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <r.icon className="h-4 w-4" />
                        {r.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.role === 'administrador' && 'Acesso total ao sistema, incluindo administração.'}
                {form.role === 'engenharia' && 'Acesso a clientes, obras e checklists.'}
                {form.role === 'rh' && 'Acesso somente a clientes e obras.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição / Cargo <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Input
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Engenheiro Civil, Coordenador de RH..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProfile ? 'Salvar' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Deactivate ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{deleteTarget?.nome}</strong> será desativado e não poderá mais acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
