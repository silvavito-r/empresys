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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Loader2, ArrowLeft, ChevronRight, Layers, Home, TreePine,
  Pencil, Trash2, GripVertical, Wand2, Check,
} from 'lucide-react'

const PAVIMENTOS_PREDEFINIDOS = [
  'Térreo', 'G01', 'G02', 'G03', 'G04',
  'Rooftop', 'Lazer', 'Casa de Máquinas', 'Barrilete',
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

  // Pavimento dialog
  const [pavDialog, setPavDialog] = useState(false)
  const [editingPav, setEditingPav] = useState<Pavimento | null>(null)
  const [pavForm, setPavForm] = useState<PavimentoInsert>({ obra_id: id!, nome: '', ordem: 0 })
  const [pavSaving, setPavSaving] = useState(false)
  const [pavInputMode, setPavInputMode] = useState<'predefined' | 'range' | 'custom'>('predefined')
  const [rangeStart, setRangeStart] = useState(2)
  const [rangeEnd, setRangeEnd] = useState(20)
  const [rangePrefix, setRangePrefix] = useState('Tipo ')

  // Delete confirmations
  const [deletePavTarget, setDeletePavTarget] = useState<Pavimento | null>(null)
  const [deleteUnidTarget, setDeleteUnidTarget] = useState<Unidade | null>(null)
  const [deleteAmbTarget, setDeleteAmbTarget] = useState<Ambiente | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Unidade dialog
  const [selectedPav, setSelectedPav] = useState<Pavimento | null>(null)
  const [unidDialog, setUnidDialog] = useState(false)
  const [editingUnid, setEditingUnid] = useState<Unidade | null>(null)
  const [unidForm, setUnidForm] = useState<UnidadeInsert>({ pavimento_id: '', nome: '', ordem: 0 })
  const [unidSaving, setUnidSaving] = useState(false)
  const [unidBulkMode, setUnidBulkMode] = useState(false)
  const [unidBulkText, setUnidBulkText] = useState('')

  // Single ambiente dialog
  const [selectedUnid, setSelectedUnid] = useState<Unidade | null>(null)
  const [ambDialog, setAmbDialog] = useState(false)
  const [ambNome, setAmbNome] = useState('')
  const [ambSaving, setAmbSaving] = useState(false)

  // ── Cross-pavimento batch unidades ──
  const [crossBatchOpen, setCrossBatchOpen] = useState(false)
  const [crossBatchPavs, setCrossBatchPavs] = useState<string[]>([])
  const [crossBatchPrefix, setCrossBatchPrefix] = useState('Apto ')
  const [crossBatchCount, setCrossBatchCount] = useState(8)
  const [crossBatchStartNum, setCrossBatchStartNum] = useState(1)
  const [crossBatchSaving, setCrossBatchSaving] = useState(false)

  // ── Batch Ambiente Modal ──
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchStep, setBatchStep] = useState<1 | 2>(1)
  const [batchAmbientes, setBatchAmbientes] = useState<string[]>([])
  const [batchCustomAmb, setBatchCustomAmb] = useState('')
  const [batchUnitMode, setBatchUnitMode] = useState<'all' | 'pavimento' | 'filter'>('all')
  const [batchPavFilter, setBatchPavFilter] = useState<string[]>([])
  const [batchNameFilter, setBatchNameFilter] = useState('')
  const [batchSaving, setBatchSaving] = useState(false)

  // Busca todos os ambientes da obra com paginação (server max_rows = 1000)
  const fetchAllAmbientes = async (): Promise<Ambiente[]> => {
    const result: Ambiente[] = []
    for (let page = 0; ; page++) {
      const { data } = await supabase
        .from('ambientes')
        .select('*, unidades!inner(pavimento_id, pavimentos!inner(obra_id))')
        .eq('unidades.pavimentos.obra_id', id)
        .range(page * 1000, page * 1000 + 999)
      if (!data || data.length === 0) break
      result.push(...(data as Ambiente[]))
      if (data.length < 1000) break
    }
    return result
  }

  const loadData = async () => {
    if (!id) return
    // Não faz setLoading(true) aqui — o loading inicial já é true via useState.
    // Recargas subsequentes (após adicionar ambientes, unidades, etc.) atualizam
    // os dados silenciosamente sem desmontar as tabs e resetar a aba ativa.
    const [{ data: obraData }, { data: pavs }, { data: unids }, ambs] = await Promise.all([
      supabase.from('obras').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('pavimentos').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('unidades').select('*, pavimentos!inner(obra_id)').eq('pavimentos.obra_id', id).order('ordem'),
      fetchAllAmbientes(),
    ])
    setObra(obraData as ObraComCliente)
    setPavimentos(pavs ?? [])
    setUnidades(unids ?? [])
    setAmbientes(ambs)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  // ── Pavimentos ──
  const openAddPav = () => {
    setEditingPav(null)
    setPavForm({ obra_id: id!, nome: '', ordem: pavimentos.length })
    setPavInputMode('predefined')
    setPavDialog(true)
  }
  const openEditPav = (p: Pavimento) => {
    setEditingPav(p)
    setPavForm({ obra_id: id!, nome: p.nome, ordem: p.ordem })
    setPavInputMode('custom')
    setPavDialog(true)
  }

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

  const addPredefined = async (nome: string) => {
    if (pavimentos.some(p => p.nome === nome)) { toast({ title: `"${nome}" já existe` }); return }
    await supabase.from('pavimentos').insert({ obra_id: id!, nome, ordem: pavimentos.length })
    toast({ title: `${nome} adicionado` })
    loadData()
  }

  const confirmDeletePav = async () => {
    if (!deletePavTarget) return
    setDeleteLoading(true)
    await supabase.from('pavimentos').delete().eq('id', deletePavTarget.id)
    toast({ title: 'Pavimento excluído' })
    setDeleteLoading(false)
    setDeletePavTarget(null)
    loadData()
  }

  // ── Unidades ──
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

  const confirmDeleteUnid = async () => {
    if (!deleteUnidTarget) return
    setDeleteLoading(true)
    await supabase.from('unidades').delete().eq('id', deleteUnidTarget.id)
    toast({ title: 'Unidade excluída' })
    setDeleteLoading(false)
    setDeleteUnidTarget(null)
    loadData()
  }

  // ── Ambientes (single) ──
  const openAddAmb = (unid: Unidade) => { setSelectedUnid(unid); setAmbNome(''); setAmbDialog(true) }

  const addAmb = async (nome: string) => {
    if (!selectedUnid) return
    const { error } = await supabase.from('ambientes').insert({ unidade_id: selectedUnid.id, nome })
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao adicionar ambiente', description: error.message })
      return
    }
    loadData()
  }

  const addAmbCustom = async () => {
    if (!ambNome.trim() || !selectedUnid) return
    setAmbSaving(true)
    try {
      const { error } = await supabase.from('ambientes').insert({ unidade_id: selectedUnid.id, nome: ambNome.trim() })
      if (error) throw error
      setAmbNome('')
      toast({ title: 'Ambiente adicionado' })
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({ variant: 'destructive', title: 'Erro ao adicionar ambiente', description: msg })
    } finally {
      setAmbSaving(false)
    }
  }

  const confirmDeleteAmb = async () => {
    if (!deleteAmbTarget) return
    setDeleteLoading(true)
    await supabase.from('ambientes').delete().eq('id', deleteAmbTarget.id)
    toast({ title: 'Ambiente excluído' })
    setDeleteLoading(false)
    setDeleteAmbTarget(null)
    loadData()
  }

  // ── Batch Ambiente Assignment ──
  const openBatch = () => {
    setBatchStep(1)
    setBatchAmbientes([])
    setBatchCustomAmb('')
    setBatchUnitMode('all')
    setBatchPavFilter([])
    setBatchNameFilter('')
    setBatchOpen(true)
  }

  const toggleBatchAmb = (nome: string) => {
    setBatchAmbientes(prev =>
      prev.includes(nome) ? prev.filter(a => a !== nome) : [...prev, nome]
    )
  }

  const addBatchCustomAmb = () => {
    const nome = batchCustomAmb.trim()
    if (!nome || batchAmbientes.includes(nome)) return
    setBatchAmbientes(prev => [...prev, nome])
    setBatchCustomAmb('')
  }

  const batchTargetUnits = (): Unidade[] => {
    if (batchUnitMode === 'all') return unidades
    if (batchUnitMode === 'pavimento') {
      return unidades.filter(u => batchPavFilter.includes(u.pavimento_id))
    }
    if (batchUnitMode === 'filter') {
      const q = batchNameFilter.toLowerCase()
      return unidades.filter(u => u.nome.toLowerCase().includes(q))
    }
    return []
  }

  const confirmBatch = async () => {
    const targets = batchTargetUnits()
    if (targets.length === 0 || batchAmbientes.length === 0) return
    setBatchSaving(true)

    try {
      // Busca todos os ambientes existentes com paginação (server max_rows = 1000)
      const allExistingAmbs: { unidade_id: string; nome: string }[] = []
      for (let page = 0; ; page++) {
        const { data, error } = await supabase
          .from('ambientes')
          .select('unidade_id, nome, unidades!inner(pavimento_id, pavimentos!inner(obra_id))')
          .eq('unidades.pavimentos.obra_id', id)
          .range(page * 1000, page * 1000 + 999)
        if (error) throw error
        if (!data || data.length === 0) break
        allExistingAmbs.push(...data.map(a => ({ unidade_id: a.unidade_id, nome: a.nome })))
        if (data.length < 1000) break
      }

      const targetIdSet = new Set(targets.map(u => u.id))

      // Filtra apenas os ambientes que pertencem às unidades alvo do batch
      const existingSet = new Set(
        allExistingAmbs
          .filter(a => targetIdSet.has(a.unidade_id))
          .map(a => `${a.unidade_id}::${a.nome}`)
      )

      const inserts: { unidade_id: string; nome: string }[] = []
      for (const unid of targets) {
        for (const amb of batchAmbientes) {
          if (!existingSet.has(`${unid.id}::${amb}`)) {
            inserts.push({ unidade_id: unid.id, nome: amb })
          }
        }
      }

      if (inserts.length === 0) {
        toast({ title: 'Todos os ambientes já existem nas unidades selecionadas' })
        setBatchOpen(false)
        return
      }

      for (let i = 0; i < inserts.length; i += 500) {
        const { error } = await supabase.from('ambientes').insert(inserts.slice(i, i + 500))
        if (error) throw error
      }
      toast({ title: `${inserts.length} ambientes atribuídos com sucesso` })
      setBatchOpen(false)
      loadData()
    } catch (e) {
      console.error('confirmBatch error:', e)
      toast({ variant: 'destructive', title: 'Erro ao atribuir ambientes. Tente novamente.' })
    } finally {
      setBatchSaving(false)
    }
  }

  const unidadesDoPav = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)
  const ambientesDaUnid = (unidId: string) => ambientes.filter(a => a.unidade_id === unidId)

  // ── Cross-pavimento batch unidades ──
  const extractFloorNum = (nome: string): number | null => {
    const match = nome.match(/\d+/)
    return match ? Number(match[0]) : null
  }

  const openCrossBatch = () => {
    const withNumber = pavimentos.filter(p => extractFloorNum(p.nome) !== null).map(p => p.id)
    setCrossBatchPavs(withNumber)
    setCrossBatchPrefix('Apto ')
    setCrossBatchCount(8)
    setCrossBatchStartNum(1)
    setCrossBatchOpen(true)
  }

  const generateCrossBatchPreview = (): { pav: Pavimento; units: string[] }[] => {
    return crossBatchPavs
      .map(id => pavimentos.find(p => p.id === id))
      .filter((p): p is Pavimento => !!p && extractFloorNum(p.nome) !== null)
      .map(pav => {
        const floorNum = extractFloorNum(pav.nome)!
        const units: string[] = []
        for (let i = crossBatchStartNum; i < crossBatchStartNum + crossBatchCount; i++) {
          units.push(`${crossBatchPrefix}${floorNum}${String(i).padStart(2, '0')}`)
        }
        return { pav, units }
      })
  }

  const saveCrossBatch = async () => {
    const preview = generateCrossBatchPreview()
    if (preview.length === 0) return
    setCrossBatchSaving(true)
    try {
      const inserts: UnidadeInsert[] = []
      for (const { pav, units } of preview) {
        const existing = unidadesDoPav(pav.id).map(u => u.nome)
        const baseOrd = unidadesDoPav(pav.id).length
        units.forEach((nome, i) => {
          if (!existing.includes(nome)) {
            inserts.push({ pavimento_id: pav.id, nome, ordem: baseOrd + i })
          }
        })
      }
      if (inserts.length === 0) {
        toast({ title: 'Todas as unidades já existem nos pavimentos selecionados' })
        setCrossBatchSaving(false)
        return
      }
      for (let i = 0; i < inserts.length; i += 500) {
        await supabase.from('unidades').insert(inserts.slice(i, i + 500))
      }
      const total = inserts.length
      const totalRequested = preview.reduce((acc, { units }) => acc + units.length, 0)
      const skipped = totalRequested - total
      toast({ title: `${total} unidades criadas${skipped > 0 ? ` (${skipped} já existiam)` : ''}` })
      setCrossBatchOpen(false)
      loadData()
    } catch (e) {
      console.error('saveCrossBatch error:', e)
      toast({ variant: 'destructive', title: 'Erro ao criar unidades. Tente novamente.' })
    } finally {
      setCrossBatchSaving(false)
    }
  }

  const formatObraEndereco = () => {
    if (!obra) return ''
    const parts = [obra.rua, obra.numero, obra.bairro].filter(Boolean).join(', ')
    const city = [obra.cidade, obra.uf].filter(Boolean).join(' - ')
    return [parts, city].filter(Boolean).join(' · ') || obra.endereco || ''
  }

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
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mt-1">
            {obra.clientes && <span>{obra.clientes.nome}</span>}
            {obra.responsavel && <><ChevronRight className="h-3 w-3" /><span>{obra.responsavel}</span></>}
            {formatObraEndereco() && <><ChevronRight className="h-3 w-3" /><span className="truncate max-w-xs">{formatObraEndereco()}</span></>}
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
          <TabsTrigger value="estrutura"><Layers className="h-4 w-4 mr-2" />Estrutura</TabsTrigger>
          <TabsTrigger value="unidades"><Home className="h-4 w-4 mr-2" />Unidades</TabsTrigger>
          <TabsTrigger value="ambientes"><TreePine className="h-4 w-4 mr-2" />Ambientes</TabsTrigger>
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
              ) : pavimentos.map(pav => (
                <div key={pav.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{pav.nome}</span>
                    <span className="text-xs text-muted-foreground">({unidadesDoPav(pav.id).length} unidades)</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPav(pav)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletePavTarget(pav)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Unidades */}
        <TabsContent value="unidades" className="mt-4">
          {pavimentos.length === 0 ? (
            <Card><CardContent className="text-center py-10 text-muted-foreground">Cadastre os pavimentos primeiro.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={openCrossBatch}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Criar Unidades em Lote
                </Button>
              </div>
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
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setDeleteUnidTarget(u)}><Trash2 className="h-3 w-3" /></Button>
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
            <>
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" onClick={openBatch}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Atribuição em lote
                </Button>
              </div>
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
                                      <button onClick={() => setDeleteAmbTarget(a)} className="ml-1 text-blue-400 hover:text-red-500">×</button>
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
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Pavimento ── */}
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

      {/* ── Dialog: Unidades ── */}
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

      {/* ── Dialog: Ambientes (single) ── */}
      <Dialog open={ambDialog} onOpenChange={setAmbDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ambientes — {selectedUnid?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Adicionados:</p>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {selectedUnid && ambientesDaUnid(selectedUnid.id).map(a => (
                  <div key={a.id} className="flex items-center gap-1 bg-blue-50 text-blue-800 rounded px-2 py-1 text-sm">
                    {a.nome}
                    <button onClick={() => setDeleteAmbTarget(a)} className="ml-1 text-blue-400 hover:text-red-500 text-base leading-none">×</button>
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

      {/* ── Dialog: Batch Ambiente Assignment ── */}
      <Dialog open={batchOpen} onOpenChange={open => { if (!open) setBatchOpen(false) }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Atribuição em Lote de Ambientes
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 py-1">
            <div className={`flex items-center gap-1.5 text-sm font-medium ${batchStep === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${batchStep === 1 ? 'bg-primary text-white' : 'bg-muted'}`}>1</span>
              Selecionar ambientes
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center gap-1.5 text-sm font-medium ${batchStep === 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${batchStep === 2 ? 'bg-primary text-white' : 'bg-muted'}`}>2</span>
              Selecionar unidades
            </div>
          </div>

          <Separator />

          {batchStep === 1 && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Selecione os ambientes que serão atribuídos:</p>
              <div className="flex flex-wrap gap-2">
                {AMBIENTES_PREDEFINIDOS.map(nome => {
                  const selected = batchAmbientes.includes(nome)
                  return (
                    <button
                      key={nome}
                      onClick={() => toggleBatchAmb(nome)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary hover:text-primary'
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      {nome}
                    </button>
                  )
                })}
              </div>
              {batchAmbientes.filter(a => !AMBIENTES_PREDEFINIDOS.includes(a)).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {batchAmbientes.filter(a => !AMBIENTES_PREDEFINIDOS.includes(a)).map(nome => (
                    <button
                      key={nome}
                      onClick={() => toggleBatchAmb(nome)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm bg-primary text-primary-foreground border-primary"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {nome}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Input
                  value={batchCustomAmb}
                  onChange={e => setBatchCustomAmb(e.target.value)}
                  placeholder="Adicionar ambiente personalizado..."
                  onKeyDown={e => { if (e.key === 'Enter') addBatchCustomAmb() }}
                />
                <Button variant="outline" onClick={addBatchCustomAmb} disabled={!batchCustomAmb.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {batchAmbientes.length > 0 && (
                <p className="text-xs text-primary font-medium">{batchAmbientes.length} ambiente(s) selecionado(s): {batchAmbientes.join(', ')}</p>
              )}
            </div>
          )}

          {batchStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                {(['all', 'pavimento', 'filter'] as const).map(m => (
                  <Button key={m} size="sm" variant={batchUnitMode === m ? 'default' : 'outline'} onClick={() => setBatchUnitMode(m)}>
                    {m === 'all' ? 'Todas' : m === 'pavimento' ? 'Por Pavimento' : 'Por Nome'}
                  </Button>
                ))}
              </div>

              {batchUnitMode === 'pavimento' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Selecione os pavimentos:</Label>
                  <div className="flex flex-wrap gap-2">
                    {pavimentos.map(pav => {
                      const sel = batchPavFilter.includes(pav.id)
                      return (
                        <button
                          key={pav.id}
                          onClick={() => setBatchPavFilter(prev => sel ? prev.filter(p => p !== pav.id) : [...prev, pav.id])}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                            sel ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'
                          }`}
                        >
                          {sel && <Check className="h-3.5 w-3.5" />}
                          {pav.nome}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {batchUnitMode === 'filter' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Filtrar unidades por nome:</Label>
                  <Input
                    value={batchNameFilter}
                    onChange={e => setBatchNameFilter(e.target.value)}
                    placeholder="Ex: 7 (filtra 701, 702...)"
                    autoFocus
                  />
                </div>
              )}

              {/* Live preview */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Prévia — {batchTargetUnits().length} unidade(s) selecionada(s):
                </p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {batchTargetUnits().slice(0, 50).map(u => (
                    <span key={u.id} className="bg-background border rounded px-1.5 py-0.5 text-xs">{u.nome}</span>
                  ))}
                  {batchTargetUnits().length > 50 && (
                    <span className="text-xs text-muted-foreground">...e mais {batchTargetUnits().length - 50}</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <strong>{batchAmbientes.length}</strong> ambiente(s) × <strong>{batchTargetUnits().length}</strong> unidade(s) = <strong>{batchAmbientes.length * batchTargetUnits().length}</strong> atribuições
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {batchStep === 2 && (
              <Button variant="outline" onClick={() => setBatchStep(1)}>Voltar</Button>
            )}
            <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancelar</Button>
            {batchStep === 1 ? (
              <Button
                onClick={() => setBatchStep(2)}
                disabled={batchAmbientes.length === 0}
              >
                Próximo
              </Button>
            ) : (
              <Button
                onClick={confirmBatch}
                disabled={batchSaving || batchTargetUnits().length === 0}
              >
                {batchSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar atribuição
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Criar Unidades em Lote (cross-pavimento) ── */}
      <Dialog open={crossBatchOpen} onOpenChange={open => { if (!open) setCrossBatchOpen(false) }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Criar Unidades em Lote
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Seleção de pavimentos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pavimentos</Label>
                <Button
                  variant="ghost" size="sm"
                  className="text-xs h-6 px-2 text-muted-foreground"
                  onClick={() => {
                    const withNum = pavimentos.filter(p => extractFloorNum(p.nome) !== null).map(p => p.id)
                    setCrossBatchPavs(crossBatchPavs.length === withNum.length ? [] : withNum)
                  }}
                >
                  {crossBatchPavs.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {pavimentos.map(pav => {
                  const hasNum = extractFloorNum(pav.nome) !== null
                  const sel = crossBatchPavs.includes(pav.id)
                  return (
                    <button
                      key={pav.id}
                      disabled={!hasNum}
                      onClick={() => setCrossBatchPavs(prev =>
                        sel ? prev.filter(id => id !== pav.id) : [...prev, pav.id]
                      )}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        !hasNum
                          ? 'opacity-30 cursor-not-allowed border-border text-muted-foreground'
                          : sel
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary hover:text-primary'
                      }`}
                    >
                      {sel && <Check className="h-3.5 w-3.5" />}
                      {pav.nome}
                    </button>
                  )
                })}
              </div>
              {pavimentos.some(p => extractFloorNum(p.nome) === null) && (
                <p className="text-xs text-muted-foreground">
                  Pavimentos sem número no nome (ex: Térreo, Rooftop) ficam desabilitados.
                </p>
              )}
            </div>

            <Separator />

            {/* Nomenclatura */}
            <div className="space-y-3">
              <Label>Nomenclatura das Unidades</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prefixo</Label>
                  <Input
                    value={crossBatchPrefix}
                    onChange={e => setCrossBatchPrefix(e.target.value)}
                    placeholder="Ex: Apto "
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Qtd. por andar</Label>
                  <Input
                    type="number" min={1} max={99}
                    value={crossBatchCount}
                    onChange={e => setCrossBatchCount(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Começa em</Label>
                  <Input
                    type="number" min={1}
                    value={crossBatchStartNum}
                    onChange={e => setCrossBatchStartNum(Math.max(1, Number(e.target.value)))}
                  />
                </div>
              </div>
              {(() => {
                const prev = generateCrossBatchPreview()
                if (prev.length === 0) return null
                const { units } = prev[0]
                return (
                  <p className="text-xs text-muted-foreground">
                    Padrão: <span className="font-mono text-foreground">
                      {units[0]}, {units[1]}{units.length > 2 ? `, ..., ${units[units.length - 1]}` : ''}
                    </span>
                  </p>
                )
              })()}
            </div>

            <Separator />

            {/* Prévia */}
            {crossBatchPavs.length > 0 && (() => {
              const prev = generateCrossBatchPreview()
              if (prev.length === 0) return null
              const totalUnits = prev.reduce((acc, { units }) => acc + units.length, 0)
              return (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    Prévia — {prev.length} pavimento(s), {totalUnits} unidade(s)
                  </Label>
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                    {prev.slice(0, 12).map(({ pav, units }) => (
                      <div key={pav.id} className="text-xs">
                        <span className="font-medium text-muted-foreground">{pav.nome}: </span>
                        <span className="font-mono">{units.join(', ')}</span>
                      </div>
                    ))}
                    {prev.length > 12 && (
                      <p className="text-xs text-muted-foreground italic">...e mais {prev.length - 12} pavimento(s)</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCrossBatchOpen(false)}>Cancelar</Button>
            <Button
              onClick={saveCrossBatch}
              disabled={crossBatchSaving || crossBatchPavs.length === 0}
            >
              {crossBatchSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {(() => {
                const total = generateCrossBatchPreview().reduce((acc, { units }) => acc + units.length, 0)
                return `Criar ${total} unidade${total !== 1 ? 's' : ''}`
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialogs ── */}
      <AlertDialog open={!!deletePavTarget} onOpenChange={open => { if (!open) setDeletePavTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pavimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{deletePavTarget?.nome}</strong> removerá todas as unidades e ambientes associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePav} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteUnidTarget} onOpenChange={open => { if (!open) setDeleteUnidTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir unidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{deleteUnidTarget?.nome}</strong> removerá todos os ambientes associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUnid} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAmbTarget} onOpenChange={open => { if (!open) setDeleteAmbTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ambiente?</AlertDialogTitle>
            <AlertDialogDescription>
              O ambiente <strong>{deleteAmbTarget?.nome}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAmb} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
