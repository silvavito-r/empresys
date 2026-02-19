import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ObraComCliente, Pavimento, PavimentoInsert, Unidade, UnidadeInsert, Ambiente } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Loader2, ArrowLeft, ChevronRight, Layers, Home, TreePine,
  Pencil, Trash2, GripVertical,
} from 'lucide-react'

const PAVIMENTOS_PREDEFINIDOS = [
  'Térreo', 'G01', 'G02', 'G03', 'G04',
  'Lazer', 'Casa de Máquinas', 'Barrilete',
]

const AMBIENTES_PREDEFINIDOS = [
  'Sala', 'Cozinha', 'Lavanderia', 'Circulação',
  'Suíte 1', 'Suíte 2', 'Suíte 3', 'Dormitório 1', 'Dormitório 2',
  'Banheiro Social', 'Área Técnica', 'Varanda', 'Hall',
]

export function ObraDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [obra, setObra] = useState<ObraComCliente | null>(null)
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [loading, setLoading] = useState(true)

  // Pavimento state
  const [pavDialog, setPavDialog] = useState(false)
  const [editingPav, setEditingPav] = useState<Pavimento | null>(null)
  const [pavForm, setPavForm] = useState<PavimentoInsert>({ obra_id: id!, nome: '', ordem: 0 })
  const [pavSaving, setPavSaving] = useState(false)
  const [pavInputMode, setPavInputMode] = useState<'predefined' | 'range' | 'custom'>('predefined')
  const [rangeStart, setRangeStart] = useState(2)
  const [rangeEnd, setRangeEnd] = useState(20)
  const [rangePrefix, setRangePrefix] = useState('Tipo ')

  // Unidade state
  const [selectedPav, setSelectedPav] = useState<Pavimento | null>(null)
  const [unidDialog, setUnidDialog] = useState(false)
  const [editingUnid, setEditingUnid] = useState<Unidade | null>(null)
  const [unidForm, setUnidForm] = useState<UnidadeInsert>({ pavimento_id: '', nome: '', ordem: 0 })
  const [unidSaving, setUnidSaving] = useState(false)
  const [unidBulkMode, setUnidBulkMode] = useState(false)
  const [unidBulkText, setUnidBulkText] = useState('')

  // Ambiente state
  const [selectedUnid, setSelectedUnid] = useState<Unidade | null>(null)
  const [ambDialog, setAmbDialog] = useState(false)
  const [ambNome, setAmbNome] = useState('')
  const [ambSaving, setAmbSaving] = useState(false)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    const [{ data: obra }, { data: pavs }, { data: unids }, { data: ambs }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('pavimentos').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('unidades').select('*, pavimentos!inner(obra_id)').eq('pavimentos.obra_id', id).order('ordem'),
      supabase.from('ambientes').select('*, unidades!inner(pavimento_id, pavimentos!inner(obra_id))').eq('unidades.pavimentos.obra_id', id),
    ])
    setObra(obra as ObraComCliente)
    setPavimentos(pavs ?? [])
    setUnidades(unids ?? [])
    setAmbientes(ambs ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  // Pavimentos
  const openAddPav = () => { setEditingPav(null); setPavForm({ obra_id: id!, nome: '', ordem: pavimentos.length }); setPavInputMode('predefined'); setPavDialog(true) }
  const openEditPav = (p: Pavimento) => { setEditingPav(p); setPavForm({ obra_id: id!, nome: p.nome, ordem: p.ordem }); setPavInputMode('custom'); setPavDialog(true) }

  const savePav = async () => {
    setPavSaving(true)
    if (editingPav) {
      await supabase.from('pavimentos').update({ nome: pavForm.nome, ordem: pavForm.ordem }).eq('id', editingPav.id)
      toast({ title: 'Pavimento atualizado' })
    } else if (pavInputMode === 'range') {
      const inserts = []
      for (let i = rangeStart; i <= rangeEnd; i++) {
        inserts.push({ obra_id: id!, nome: `${rangePrefix}${i}`, ordem: pavimentos.length + inserts.length })
      }
      await supabase.from('pavimentos').insert(inserts)
      toast({ title: `${inserts.length} pavimentos criados` })
    } else {
      await supabase.from('pavimentos').insert({ ...pavForm })
      toast({ title: 'Pavimento criado' })
    }
    setPavSaving(false)
    setPavDialog(false)
    loadData()
  }

  const deletePav = async (p: Pavimento) => {
    if (!confirm(`Excluir "${p.nome}"? Todas as unidades serão removidas.`)) return
    await supabase.from('pavimentos').delete().eq('id', p.id)
    toast({ title: 'Pavimento excluído' })
    loadData()
  }

  const addPredefined = async (nome: string) => {
    if (pavimentos.some(p => p.nome === nome)) { toast({ title: `"${nome}" já existe` }); return }
    await supabase.from('pavimentos').insert({ obra_id: id!, nome, ordem: pavimentos.length })
    toast({ title: `${nome} adicionado` })
    loadData()
  }

  // Unidades
  const openAddUnid = (pav: Pavimento) => {
    setSelectedPav(pav)
    setEditingUnid(null)
    setUnidForm({ pavimento_id: pav.id, nome: '', ordem: unidadesDoPav(pav.id).length })
    setUnidBulkMode(false)
    setUnidBulkText('')
    setUnidDialog(true)
  }

  const openEditUnid = (u: Unidade) => {
    const pav = pavimentos.find(p => p.id === u.pavimento_id) ?? null
    setSelectedPav(pav)
    setEditingUnid(u)
    setUnidForm({ pavimento_id: u.pavimento_id, nome: u.nome, ordem: u.ordem })
    setUnidBulkMode(false)
    setUnidDialog(true)
  }

  const saveUnid = async () => {
    setUnidSaving(true)
    if (editingUnid) {
      await supabase.from('unidades').update({ nome: unidForm.nome }).eq('id', editingUnid.id)
      toast({ title: 'Unidade atualizada' })
    } else if (unidBulkMode) {
      const nomes = unidBulkText.split('\n').map(s => s.trim()).filter(Boolean)
      if (nomes.length === 0) { setUnidSaving(false); return }
      const ord = unidadesDoPav(unidForm.pavimento_id).length
      await supabase.from('unidades').insert(nomes.map((nome, i) => ({ pavimento_id: unidForm.pavimento_id, nome, ordem: ord + i })))
      toast({ title: `${nomes.length} unidades criadas` })
    } else {
      await supabase.from('unidades').insert(unidForm)
      toast({ title: 'Unidade criada' })
    }
    setUnidSaving(false)
    setUnidDialog(false)
    loadData()
  }

  const deleteUnid = async (u: Unidade) => {
    if (!confirm(`Excluir "${u.nome}"?`)) return
    await supabase.from('unidades').delete().eq('id', u.id)
    toast({ title: 'Unidade excluída' })
    loadData()
  }

  // Ambientes
  const openAddAmb = (unid: Unidade) => { setSelectedUnid(unid); setAmbNome(''); setAmbDialog(true) }

  const addAmb = async (nome: string) => {
    if (!selectedUnid) return
    await supabase.from('ambientes').insert({ unidade_id: selectedUnid.id, nome })
    loadData()
  }

  const addAmbCustom = async () => {
    if (!ambNome.trim() || !selectedUnid) return
    setAmbSaving(true)
    await supabase.from('ambientes').insert({ unidade_id: selectedUnid.id, nome: ambNome.trim() })
    setAmbNome('')
    setAmbSaving(false)
    toast({ title: 'Ambiente adicionado' })
    loadData()
  }

  const deleteAmb = async (a: Ambiente) => {
    await supabase.from('ambientes').delete().eq('id', a.id)
    loadData()
  }

  const unidadesDoPav = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)
  const ambientesDaUnid = (unidId: string) => ambientes.filter(a => a.unidade_id === unidId)

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!obra) return <div className="text-center py-16 text-muted-foreground">Obra não encontrada.</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link to="/obras"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{obra.nome}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            {obra.clientes && <span>{obra.clientes.nome}</span>}
            {obra.responsavel && <><ChevronRight className="h-3 w-3" /><span>{obra.responsavel}</span></>}
            {obra.endereco && <><ChevronRight className="h-3 w-3" /><span>{obra.endereco}</span></>}
          </div>
        </div>
        <div className="ml-auto">
          <Badge variant={obra.status === 'ativa' ? 'success' : obra.status === 'pausada' ? 'warning' : 'secondary'}>
            {obra.status === 'ativa' ? 'Ativa' : obra.status === 'pausada' ? 'Pausada' : 'Concluída'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="estrutura">
        <TabsList>
          <TabsTrigger value="estrutura">
            <Layers className="h-4 w-4 mr-2" />Estrutura
          </TabsTrigger>
          <TabsTrigger value="unidades">
            <Home className="h-4 w-4 mr-2" />Unidades
          </TabsTrigger>
          <TabsTrigger value="ambientes">
            <TreePine className="h-4 w-4 mr-2" />Ambientes
          </TabsTrigger>
        </TabsList>

        {/* TAB: Pavimentos */}
        <TabsContent value="estrutura" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pavimentos ({pavimentos.length})</CardTitle>
              <Button size="sm" onClick={openAddPav}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {pavimentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum pavimento cadastrado</p>
              ) : (
                pavimentos.map(pav => (
                  <div key={pav.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{pav.nome}</span>
                      <span className="text-xs text-muted-foreground">({unidadesDoPav(pav.id).length} unidades)</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPav(pav)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePav(pav)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Unidades */}
        <TabsContent value="unidades" className="mt-4">
          {pavimentos.length === 0 ? (
            <Card><CardContent className="text-center py-10 text-muted-foreground">Cadastre os pavimentos primeiro.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {pavimentos.map(pav => (
                <Card key={pav.id}>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{pav.nome}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => openAddUnid(pav)}><Plus className="mr-1 h-3 w-3" />Unidade</Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {unidadesDoPav(pav.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhuma unidade</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {unidadesDoPav(pav.id).map(u => (
                          <div key={u.id} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                            <span className="text-sm font-medium">{u.nome}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditUnid(u)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteUnid(u)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB: Ambientes */}
        <TabsContent value="ambientes" className="mt-4">
          {unidades.length === 0 ? (
            <Card><CardContent className="text-center py-10 text-muted-foreground">Cadastre as unidades primeiro.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {pavimentos.map(pav => {
                const pavUnids = unidadesDoPav(pav.id)
                if (pavUnids.length === 0) return null
                return (
                  <div key={pav.id}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{pav.nome}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pavUnids.map(unid => (
                        <Card key={unid.id} className="text-sm">
                          <CardHeader className="py-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">{unid.nome}</CardTitle>
                            <Button size="sm" variant="ghost" onClick={() => openAddAmb(unid)}><Plus className="h-3.5 w-3.5" /></Button>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {ambientesDaUnid(unid.id).length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sem ambientes</p>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {ambientesDaUnid(unid.id).map(a => (
                                  <div key={a.id} className="flex items-center gap-0.5 bg-blue-50 text-blue-800 rounded px-2 py-0.5 text-xs">
                                    {a.nome}
                                    <button onClick={() => deleteAmb(a)} className="ml-1 text-blue-400 hover:text-red-500">×</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Pavimento */}
      <Dialog open={pavDialog} onOpenChange={setPavDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingPav ? 'Editar Pavimento' : 'Adicionar Pavimento'}</DialogTitle></DialogHeader>
          {editingPav ? (
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={pavForm.nome} onChange={e => setPavForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={pavForm.ordem} onChange={e => setPavForm(f => ({ ...f, ordem: Number(e.target.value) }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                {(['predefined', 'range', 'custom'] as const).map(m => (
                  <Button key={m} size="sm" variant={pavInputMode === m ? 'default' : 'outline'} onClick={() => setPavInputMode(m)}>
                    {m === 'predefined' ? 'Pré-definido' : m === 'range' ? 'Faixa' : 'Personalizado'}
                  </Button>
                ))}
              </div>
              {pavInputMode === 'predefined' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Clique para adicionar diretamente:</p>
                  <div className="flex flex-wrap gap-2">
                    {PAVIMENTOS_PREDEFINIDOS.map(nome => (
                      <Button key={nome} size="sm" variant="outline"
                        className={pavimentos.some(p => p.nome === nome) ? 'opacity-40' : ''}
                        onClick={async () => { await addPredefined(nome); setPavDialog(false) }}>
                        {nome}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {pavInputMode === 'range' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Prefixo</Label>
                    <Input value={rangePrefix} onChange={e => setRangePrefix(e.target.value)} placeholder="Ex: Tipo " />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>De</Label><Input type="number" value={rangeStart} onChange={e => setRangeStart(Number(e.target.value))} /></div>
                    <div className="space-y-1"><Label>Até</Label><Input type="number" value={rangeEnd} onChange={e => setRangeEnd(Number(e.target.value))} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Criará: {rangePrefix}{rangeStart} a {rangePrefix}{rangeEnd} ({Math.max(0, rangeEnd - rangeStart + 1)} pavimentos)</p>
                </div>
              )}
              {pavInputMode === 'custom' && (
                <div className="space-y-2">
                  <Label>Nome do Pavimento</Label>
                  <Input value={pavForm.nome} onChange={e => setPavForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Subsolo" autoFocus />
                </div>
              )}
            </div>
          )}
          {pavInputMode !== 'predefined' && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setPavDialog(false)}>Cancelar</Button>
              <Button onClick={savePav} disabled={pavSaving}>
                {pavSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingPav ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Unidades */}
      <Dialog open={unidDialog} onOpenChange={setUnidDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingUnid ? 'Editar Unidade' : `Adicionar Unidade — ${selectedPav?.nome}`}</DialogTitle></DialogHeader>
          {!editingUnid && (
            <div className="flex gap-2 py-1">
              <Button size="sm" variant={!unidBulkMode ? 'default' : 'outline'} onClick={() => setUnidBulkMode(false)}>Individual</Button>
              <Button size="sm" variant={unidBulkMode ? 'default' : 'outline'} onClick={() => setUnidBulkMode(true)}>Várias de vez</Button>
            </div>
          )}
          <div className="space-y-3 py-1">
            {unidBulkMode ? (
              <div className="space-y-2">
                <Label>Nomes (uma por linha)</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={unidBulkText}
                  onChange={e => setUnidBulkText(e.target.value)}
                  placeholder={'701\n702\n703\n...'}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Nome da Unidade</Label>
                <Input value={unidForm.nome} onChange={e => setUnidForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: 701" autoFocus />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnidDialog(false)}>Cancelar</Button>
            <Button onClick={saveUnid} disabled={unidSaving}>
              {unidSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingUnid ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ambientes */}
      <Dialog open={ambDialog} onOpenChange={setAmbDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ambientes — {selectedUnid?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Ambientes já adicionados:</p>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {selectedUnid && ambientesDaUnid(selectedUnid.id).map(a => (
                  <div key={a.id} className="flex items-center gap-1 bg-blue-50 text-blue-800 rounded px-2 py-1 text-sm">
                    {a.nome}
                    <button onClick={async () => { await deleteAmb(a) }} className="ml-1 text-blue-400 hover:text-red-500 text-base leading-none">×</button>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Ambientes comuns:</p>
              <div className="flex flex-wrap gap-2">
                {AMBIENTES_PREDEFINIDOS.map(nome => {
                  const existe = selectedUnid ? ambientesDaUnid(selectedUnid.id).some(a => a.nome === nome) : false
                  return (
                    <Button key={nome} size="sm" variant="outline"
                      className={existe ? 'opacity-40' : ''}
                      disabled={existe}
                      onClick={() => addAmb(nome)}>
                      {nome}
                    </Button>
                  )
                })}
              </div>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Input value={ambNome} onChange={e => setAmbNome(e.target.value)} placeholder="Ambiente personalizado" onKeyDown={e => { if (e.key === 'Enter') addAmbCustom() }} />
              <Button onClick={addAmbCustom} disabled={ambSaving || !ambNome.trim()}>
                {ambSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAmbDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
