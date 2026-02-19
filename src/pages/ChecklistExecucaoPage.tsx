import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Checklist, ChecklistItem, Pavimento, Unidade, ChecklistExecucao, ExecucaoStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, ChevronRight, Check, X, Minus, Camera,
  Loader2, MessageSquare, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ExecMap = Map<string, ChecklistExecucao> // key: `${itemId}:${unidadeId}`

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-600', icon: Minus },
  ok: { label: 'OK', color: 'bg-green-100 text-green-700', icon: Check },
  nao_ok: { label: 'Não OK', color: 'bg-red-100 text-red-700', icon: X },
  nao_aplicavel: { label: 'N/A', color: 'bg-yellow-100 text-yellow-700', icon: Minus },
}

export function ChecklistExecucaoPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [execMap, setExecMap] = useState<ExecMap>(new Map())
  const [loading, setLoading] = useState(true)

  const [selectedPav, setSelectedPav] = useState<Pavimento | null>(null)
  const [selectedUnid, setSelectedUnid] = useState<Unidade | null>(null)

  // Nota dialog
  const [notaDialog, setNotaDialog] = useState(false)
  const [notaItem, setNotaItem] = useState<ChecklistItem | null>(null)
  const [notaText, setNotaText] = useState('')
  const [notaSaving, setNotaSaving] = useState(false)

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    const { data: cl } = await supabase.from('checklists').select('*').eq('id', id).single()
    if (!cl) { setLoading(false); return }
    setChecklist(cl)

    const [{ data: items }, { data: execs }] = await Promise.all([
      supabase.from('checklist_itens').select('*').eq('checklist_id', id).order('ordem'),
      supabase.from('checklist_execucoes').select('*').eq('checklist_id', id),
    ])

    const execList = execs ?? []
    const map = new Map<string, ChecklistExecucao>()
    execList.forEach(e => { map.set(`${e.item_id}:${e.unidade_id}`, e) })
    setExecMap(map)
    setItens(items ?? [])

    // Load pavimentos+unidades from first exec
    if (execList.length > 0) {
      const unidIds = [...new Set(execList.map(e => e.unidade_id))]
      const { data: unids } = await supabase.from('unidades').select('*').in('id', unidIds).order('ordem')
      const pavIds = [...new Set((unids ?? []).map(u => u.pavimento_id))]
      const { data: pavs } = await supabase.from('pavimentos').select('*').in('id', pavIds).order('ordem')
      setPavimentos(pavs ?? [])
      setUnidades(unids ?? [])
      if (pavs && pavs.length > 0 && !selectedPav) setSelectedPav(pavs[0])
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const execKey = (itemId: string, unidId: string) => `${itemId}:${unidId}`

  const getExec = (itemId: string, unidId: string) => execMap.get(execKey(itemId, unidId))

  const updateStatus = async (item: ChecklistItem, unid: Unidade, newStatus: ExecucaoStatus) => {
    const existing = getExec(item.id, unid.id)
    const pav = pavimentos.find(p => p.id === unid.pavimento_id)
    if (!pav || !id) return

    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()

    if (existing) {
      const { data } = await supabase.from('checklist_execucoes').update({
        status: newStatus,
        verificado_em: now,
        verificado_por: user?.id ?? null,
      }).eq('id', existing.id).select().single()

      if (data) {
        const newMap = new Map(execMap)
        newMap.set(execKey(item.id, unid.id), data as ChecklistExecucao)
        setExecMap(newMap)
      }
    } else {
      const { data } = await supabase.from('checklist_execucoes').insert({
        checklist_id: id,
        item_id: item.id,
        pavimento_id: pav.id,
        unidade_id: unid.id,
        status: newStatus,
        verificado_em: now,
        verificado_por: user?.id ?? null,
      }).select().single()

      if (data) {
        const newMap = new Map(execMap)
        newMap.set(execKey(item.id, unid.id), data as ChecklistExecucao)
        setExecMap(newMap)
      }
    }
  }

  const openNota = (item: ChecklistItem, unid: Unidade) => {
    setNotaItem(item)
    const existing = getExec(item.id, unid.id)
    setNotaText(existing?.nota ?? '')
    setNotaDialog(true)
  }

  const saveNota = async () => {
    if (!notaItem || !selectedUnid || !id) return
    setNotaSaving(true)
    const existing = getExec(notaItem.id, selectedUnid.id)
    const pav = pavimentos.find(p => p.id === selectedUnid.pavimento_id)
    if (!pav) { setNotaSaving(false); return }

    if (existing) {
      const { data } = await supabase.from('checklist_execucoes').update({ nota: notaText || null }).eq('id', existing.id).select().single()
      if (data) {
        const newMap = new Map(execMap)
        newMap.set(execKey(notaItem.id, selectedUnid.id), data as ChecklistExecucao)
        setExecMap(newMap)
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('checklist_execucoes').insert({
        checklist_id: id, item_id: notaItem.id, pavimento_id: pav.id, unidade_id: selectedUnid.id,
        status: 'pendente', nota: notaText || null, verificado_por: user?.id ?? null,
      }).select().single()
      if (data) {
        const newMap = new Map(execMap)
        newMap.set(execKey(notaItem.id, selectedUnid.id), data as ChecklistExecucao)
        setExecMap(newMap)
      }
    }
    setNotaDialog(false)
    setNotaSaving(false)
    toast({ title: 'Nota salva' })
  }

  const handlePhotoUpload = async (item: ChecklistItem, unid: Unidade, file: File) => {
    if (!id) return
    const pav = pavimentos.find(p => p.id === unid.pavimento_id)
    if (!pav) return

    setUploadingItemId(item.id)
    const filename = `${id}/${item.id}/${unid.id}/${Date.now()}_${file.name}`
    const { data: uploadData, error } = await supabase.storage.from('checklist-fotos').upload(filename, file)

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao enviar foto' })
      setUploadingItemId(null)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('checklist-fotos').getPublicUrl(uploadData.path)
    const existing = getExec(item.id, unid.id)
    const { data: { user } } = await supabase.auth.getUser()

    if (existing) {
      const { data } = await supabase.from('checklist_execucoes').update({ foto_url: publicUrl }).eq('id', existing.id).select().single()
      if (data) { const newMap = new Map(execMap); newMap.set(execKey(item.id, unid.id), data as ChecklistExecucao); setExecMap(newMap) }
    } else {
      const { data } = await supabase.from('checklist_execucoes').insert({
        checklist_id: id, item_id: item.id, pavimento_id: pav.id, unidade_id: unid.id,
        status: 'pendente', foto_url: publicUrl, verificado_por: user?.id ?? null,
      }).select().single()
      if (data) { const newMap = new Map(execMap); newMap.set(execKey(item.id, unid.id), data as ChecklistExecucao); setExecMap(newMap) }
    }

    setUploadingItemId(null)
    toast({ title: 'Foto enviada' })
  }

  // Progress calculation
  const unidadesDoPav = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)

  const calcProgress = () => {
    const total = execMap.size
    const done = [...execMap.values()].filter(e => e.status !== 'pendente').length
    return total === 0 ? 0 : Math.round((done / total) * 100)
  }

  const unidProgress = (unidId: string) => {
    const unidExecs = itens.map(item => getExec(item.id, unidId))
    const total = unidExecs.length
    const done = unidExecs.filter(e => e && e.status !== 'pendente').length
    const nok = unidExecs.filter(e => e && e.status === 'nao_ok').length
    return { total, done, nok, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!checklist) return <div className="text-center py-16 text-muted-foreground">Checklist não encontrado.</div>

  const progress = calcProgress()
  const currentUnidExecs = selectedUnid ? itens.map(item => ({ item, exec: getExec(item.id, selectedUnid.id) })) : []

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/checklists/${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">{checklist.nome}</h2>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/checklists/${id}/relatorio`}><BarChart2 className="h-4 w-4 mr-1" />Relatório</Link>
        </Button>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span>Progresso geral</span>
          <span className="text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {[...execMap.values()].filter(e => e.status !== 'pendente').length} de {execMap.size} verificações concluídas
        </p>
      </div>

      {/* Pavimento selector */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Selecione o pavimento:</p>
        <div className="flex flex-wrap gap-2">
          {pavimentos.map(pav => (
            <Button
              key={pav.id}
              size="sm"
              variant={selectedPav?.id === pav.id ? 'default' : 'outline'}
              onClick={() => { setSelectedPav(pav); setSelectedUnid(null) }}
            >
              {pav.nome}
            </Button>
          ))}
        </div>
      </div>

      {/* Unidade selector */}
      {selectedPav && (
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Selecione a unidade — {selectedPav.nome}:</p>
          <div className="flex flex-wrap gap-2">
            {unidadesDoPav(selectedPav.id).map(unid => {
              const prog = unidProgress(unid.id)
              return (
                <Button
                  key={unid.id}
                  size="sm"
                  variant={selectedUnid?.id === unid.id ? 'default' : 'outline'}
                  onClick={() => setSelectedUnid(unid)}
                  className={cn(
                    'relative',
                    prog.nok > 0 && selectedUnid?.id !== unid.id && 'border-red-300 text-red-600',
                    prog.pct === 100 && selectedUnid?.id !== unid.id && 'border-green-300 text-green-700'
                  )}
                >
                  {unid.nome}
                  {prog.total > 0 && (
                    <span className={cn(
                      'ml-1.5 text-xs opacity-70',
                      prog.pct === 100 ? 'text-green-600' : ''
                    )}>
                      {prog.pct}%
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Items list for selected unit */}
      {selectedUnid && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">{selectedPav?.nome} — {selectedUnid.nome}</h3>
            <span className="text-xs text-muted-foreground">
              {unidProgress(selectedUnid.id).done}/{itens.length} concluídos
            </span>
          </div>

          <div className="divide-y">
            {currentUnidExecs.map(({ item, exec }) => {
              const status = (exec?.status ?? 'pendente') as ExecucaoStatus
              const cfg = statusConfig[status]
              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-sm flex-1 font-medium leading-snug">{item.nome}</span>
                  </div>

                  {/* Status buttons */}
                  <div className="flex gap-2">
                    {(['ok', 'nao_ok', 'nao_aplicavel'] as ExecucaoStatus[]).map(s => {
                      const c = statusConfig[s]
                      return (
                        <button
                          key={s}
                          onClick={() => updateStatus(item, selectedUnid, s)}
                          className={cn(
                            'flex-1 h-10 rounded-lg text-xs font-semibold border-2 transition-all',
                            status === s
                              ? s === 'ok' ? 'bg-green-500 text-white border-green-500'
                                : s === 'nao_ok' ? 'bg-red-500 text-white border-red-500'
                                  : 'bg-yellow-500 text-white border-yellow-500'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                          )}
                        >
                          {c.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Note + photo */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn('gap-1 text-xs h-8', exec?.nota ? 'text-blue-600' : 'text-muted-foreground')}
                      onClick={() => openNota(item, selectedUnid)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {exec?.nota ? 'Ver nota' : 'Nota'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn('gap-1 text-xs h-8', exec?.foto_url ? 'text-blue-600' : 'text-muted-foreground')}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingItemId === item.id}
                    >
                      {uploadingItemId === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Camera className="h-3.5 w-3.5" />}
                      {exec?.foto_url ? 'Ver foto' : 'Foto'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handlePhotoUpload(item, selectedUnid, file)
                        e.target.value = ''
                      }}
                    />
                    {exec?.foto_url && (
                      <a href={exec.foto_url} target="_blank" rel="noopener noreferrer">
                        <img src={exec.foto_url} alt="foto" className="h-8 w-8 object-cover rounded border" />
                      </a>
                    )}
                  </div>

                  {exec?.nota && (
                    <div className="text-xs bg-blue-50 text-blue-800 rounded p-2 border border-blue-100">
                      {exec.nota}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Nota Dialog */}
      <Dialog open={notaDialog} onOpenChange={setNotaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nota — {notaItem?.nome}</DialogTitle></DialogHeader>
          <Textarea value={notaText} onChange={e => setNotaText(e.target.value)} placeholder="Descreva a situação encontrada..." rows={4} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotaDialog(false)}>Cancelar</Button>
            <Button onClick={saveNota} disabled={notaSaving}>
              {notaSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
