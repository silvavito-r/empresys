import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Checklist, ChecklistItem, Pavimento, Unidade, Ambiente, ChecklistExecucao, ExecucaoStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, Camera, Loader2, MessageSquare, BarChart2,
  Layers, Home, Grid3x3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ExecMap key strategy:
//   pavimento-scope → `pav:${pavId}:${itemId}`
//   unidade-scope   → `unid:${unidId}:${itemId}`
//   ambiente-scope  → `amb:${ambId}:${itemId}`
type ExecMap = Map<string, ChecklistExecucao>

const statusConfig: Record<ExecucaoStatus, { label: string }> = {
  pendente: { label: 'Pendente' },
  ok: { label: 'OK' },
  nao_ok: { label: 'Não OK' },
  nao_aplicavel: { label: 'N/A' },
}

function buildKey(exec: ChecklistExecucao): string {
  if (exec.ambiente_id) return `amb:${exec.ambiente_id}:${exec.item_id}`
  if (exec.unidade_id) return `unid:${exec.unidade_id}:${exec.item_id}`
  return `pav:${exec.pavimento_id}:${exec.item_id}`
}

function StatusButtons({ status, onSet }: { status: ExecucaoStatus; onSet: (s: ExecucaoStatus) => void }) {
  return (
    <div className="flex gap-2">
      {(['ok', 'nao_ok', 'nao_aplicavel'] as ExecucaoStatus[]).map(s => (
        <button key={s} onClick={() => onSet(s)}
          className={cn(
            'flex-1 h-10 rounded-lg text-xs font-semibold border-2 transition-all',
            status === s
              ? s === 'ok' ? 'bg-green-500 text-white border-green-500'
                : s === 'nao_ok' ? 'bg-red-500 text-white border-red-500'
                  : 'bg-yellow-500 text-white border-yellow-500'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
          )}>
          {statusConfig[s].label}
        </button>
      ))}
    </div>
  )
}

interface ItemRowProps {
  item: ChecklistItem
  exec: ChecklistExecucao | undefined
  onStatus: (s: ExecucaoStatus) => void
  onNota: () => void
  onPhoto: () => void
  uploading: boolean
}

function ItemRow({ item, exec, onStatus, onNota, onPhoto, uploading }: ItemRowProps) {
  const status = (exec?.status ?? 'pendente') as ExecucaoStatus
  return (
    <div className="p-4 space-y-3 border-b last:border-b-0">
      <p className="text-sm font-medium leading-snug">{item.nome}</p>
      <StatusButtons status={status} onSet={onStatus} />
      <div className="flex gap-2 items-center">
        <Button size="sm" variant="ghost"
          className={cn('gap-1 text-xs h-8', exec?.nota ? 'text-blue-600' : 'text-muted-foreground')}
          onClick={onNota}>
          <MessageSquare className="h-3.5 w-3.5" />
          {exec?.nota ? 'Ver nota' : 'Nota'}
        </Button>
        <Button size="sm" variant="ghost"
          className={cn('gap-1 text-xs h-8', exec?.foto_url ? 'text-blue-600' : 'text-muted-foreground')}
          onClick={onPhoto} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {exec?.foto_url ? 'Ver foto' : 'Foto'}
        </Button>
        {exec?.foto_url && (
          <a href={exec.foto_url} target="_blank" rel="noopener noreferrer">
            <img src={exec.foto_url} alt="foto" className="h-8 w-8 object-cover rounded border" />
          </a>
        )}
      </div>
      {exec?.nota && (
        <div className="text-xs bg-blue-50 text-blue-800 rounded p-2 border border-blue-100">{exec.nota}</div>
      )}
    </div>
  )
}

export function ChecklistExecucaoPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [execMap, setExecMap] = useState<ExecMap>(new Map())
  const [loading, setLoading] = useState(true)

  const [selectedPav, setSelectedPav] = useState<Pavimento | null>(null)
  const [selectedUnid, setSelectedUnid] = useState<Unidade | null>(null)
  const [selectedAmb, setSelectedAmb] = useState<Ambiente | null>(null)

  const [notaDialog, setNotaDialog] = useState(false)
  const [notaKey, setNotaKey] = useState('')
  const [notaItem, setNotaItem] = useState<ChecklistItem | null>(null)
  const [notaText, setNotaText] = useState('')
  const [notaInsertData, setNotaInsertData] = useState<object>({})
  const [notaSaving, setNotaSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoTarget, setPhotoTarget] = useState<{ key: string; insertData: object } | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    const { data: cl } = await supabase.from('checklists').select('*, obras(id)').eq('id', id).single()
    if (!cl) { setLoading(false); return }
    setChecklist(cl as Checklist)

    const obraId = (cl as { obra_id: string }).obra_id
    const { data: items } = await supabase.from('checklist_itens').select('*').eq('checklist_id', id).order('ordem')
    const itemList = (items as ChecklistItem[]) ?? []
    setItens(itemList)

    const { data: pavs } = await supabase.from('pavimentos').select('*').eq('obra_id', obraId).order('ordem')
    const pavList = (pavs ?? []) as Pavimento[]
    setPavimentos(pavList)

    let unidList: Unidade[] = []
    let ambList: Ambiente[] = []
    if (pavList.length > 0) {
      const pavIds = pavList.map(p => p.id)
      const { data: unids } = await supabase.from('unidades').select('*').in('pavimento_id', pavIds).order('ordem')
      unidList = (unids ?? []) as Unidade[]
      setUnidades(unidList)
      if (itemList.some(i => i.scope === 'ambiente') && unidList.length > 0) {
        const { data: ambs } = await supabase.from('ambientes').select('*').in('unidade_id', unidList.map(u => u.id))
        ambList = (ambs ?? []) as Ambiente[]
        setAmbientes(ambList)
      }
    }

    const { data: execs } = await supabase.from('checklist_execucoes').select('*').eq('checklist_id', id)
    const map = new Map<string, ChecklistExecucao>()
    ;(execs ?? []).forEach((e: ChecklistExecucao) => { map.set(buildKey(e), e) })
    setExecMap(map)

    if (pavList.length > 0) setSelectedPav(p => p ?? pavList[0])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const upsertExec = async (key: string, insertData: object, updateData: object) => {
    const existing = execMap.get(key)
    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()
    let result: ChecklistExecucao | null = null
    if (existing) {
      const { data } = await supabase.from('checklist_execucoes')
        .update({ ...updateData, verificado_em: now, verificado_por: user?.id ?? null })
        .eq('id', existing.id).select().single()
      result = data as ChecklistExecucao
    } else {
      const { data } = await supabase.from('checklist_execucoes')
        .insert({ ...insertData, verificado_em: now, verificado_por: user?.id ?? null })
        .select().single()
      result = data as ChecklistExecucao
    }
    if (result) { const m = new Map(execMap); m.set(key, result); setExecMap(m) }
  }

  const pavKey = (item: ChecklistItem, pavId: string) => `pav:${pavId}:${item.id}`
  const unidKey = (item: ChecklistItem, unidId: string) => `unid:${unidId}:${item.id}`
  const ambKey = (item: ChecklistItem, ambId: string) => `amb:${ambId}:${item.id}`

  const openNota = (item: ChecklistItem, key: string, insertData: object) => {
    setNotaItem(item); setNotaKey(key); setNotaText(execMap.get(key)?.nota ?? ''); setNotaInsertData(insertData); setNotaDialog(true)
  }

  const saveNota = async () => {
    setNotaSaving(true)
    const existing = execMap.get(notaKey)
    if (existing) {
      const { data } = await supabase.from('checklist_execucoes').update({ nota: notaText || null }).eq('id', existing.id).select().single()
      if (data) { const m = new Map(execMap); m.set(notaKey, data as ChecklistExecucao); setExecMap(m) }
    } else {
      const { data } = await supabase.from('checklist_execucoes').insert({ ...notaInsertData, nota: notaText || null }).select().single()
      if (data) { const m = new Map(execMap); m.set(notaKey, data as ChecklistExecucao); setExecMap(m) }
    }
    setNotaDialog(false); setNotaSaving(false); toast({ title: 'Nota salva' })
  }

  const openPhoto = (key: string, insertData: object) => {
    setPhotoTarget({ key, insertData }); fileInputRef.current?.click()
  }

  const handlePhotoUpload = async (file: File) => {
    if (!photoTarget || !id) return
    const { key, insertData } = photoTarget
    setUploadingKey(key)
    const filename = `${id}/${Date.now()}_${file.name}`
    const { data: uploaded, error } = await supabase.storage.from('checklist-fotos').upload(filename, file)
    if (error) { toast({ variant: 'destructive', title: 'Erro ao enviar foto' }); setUploadingKey(null); return }
    const { data: { publicUrl } } = supabase.storage.from('checklist-fotos').getPublicUrl(uploaded.path)
    const existing = execMap.get(key)
    if (existing) {
      const { data } = await supabase.from('checklist_execucoes').update({ foto_url: publicUrl }).eq('id', existing.id).select().single()
      if (data) { const m = new Map(execMap); m.set(key, data as ChecklistExecucao); setExecMap(m) }
    } else {
      const { data } = await supabase.from('checklist_execucoes').insert({ ...insertData, foto_url: publicUrl }).select().single()
      if (data) { const m = new Map(execMap); m.set(key, data as ChecklistExecucao); setExecMap(m) }
    }
    setUploadingKey(null); toast({ title: 'Foto enviada' })
  }

  const unidadesDoPav = (pavId: string) => unidades.filter(u => u.pavimento_id === pavId)
  const ambientesDaUnid = (unidId: string) => ambientes.filter(a => a.unidade_id === unidId)

  const unidPct = (unidId: string) => {
    const scoped = itens.filter(i => i.scope === 'unidade')
    if (scoped.length === 0) return null
    const done = scoped.filter(i => { const e = execMap.get(unidKey(i, unidId)); return e && e.status !== 'pendente' }).length
    const nok = scoped.filter(i => execMap.get(unidKey(i, unidId))?.status === 'nao_ok').length
    return { pct: Math.round((done / scoped.length) * 100), nok }
  }

  const progress = (() => {
    const total = execMap.size
    const done = [...execMap.values()].filter(e => e.status !== 'pendente').length
    return total === 0 ? 0 : Math.round((done / total) * 100)
  })()

  const itensPav = itens.filter(i => i.scope === 'pavimento')
  const itensUnid = itens.filter(i => i.scope === 'unidade')
  const itensAmb = itens.filter(i => i.scope === 'ambiente')

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!checklist) return <div className="text-center py-16 text-muted-foreground">Checklist não encontrado.</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to={`/checklists/${id}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
        <h2 className="font-bold text-lg flex-1 truncate">{checklist.nome}</h2>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/checklists/${id}/relatorio`}><BarChart2 className="h-4 w-4 mr-1" />Relatório</Link>
        </Button>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span>Progresso geral</span><span className="text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {[...execMap.values()].filter(e => e.status !== 'pendente').length} de {execMap.size} verificações concluídas
        </p>
      </div>

      {/* Pavimento selector */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Pavimento</p>
        <div className="flex flex-wrap gap-2">
          {pavimentos.map(pav => (
            <Button key={pav.id} size="sm" variant={selectedPav?.id === pav.id ? 'default' : 'outline'}
              onClick={() => { setSelectedPav(pav); setSelectedUnid(null); setSelectedAmb(null) }}>
              {pav.nome}
            </Button>
          ))}
        </div>
      </div>

      {/* Pavimento-scoped items */}
      {selectedPav && itensPav.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-50 border-b flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Verificações do Pavimento — {selectedPav.nome}</span>
          </div>
          <div className="divide-y">
            {itensPav.map(item => {
              const key = pavKey(item, selectedPav.id)
              const insertData = { checklist_id: id, item_id: item.id, pavimento_id: selectedPav.id, unidade_id: null, ambiente_id: null, status: 'pendente' }
              return (
                <ItemRow key={item.id} item={item} exec={execMap.get(key)}
                  onStatus={s => upsertExec(key, insertData, { status: s })}
                  onNota={() => openNota(item, key, insertData)}
                  onPhoto={() => openPhoto(key, insertData)}
                  uploading={uploadingKey === key} />
              )
            })}
          </div>
        </div>
      )}

      {/* Unidade selector */}
      {selectedPav && (itensUnid.length > 0 || itensAmb.length > 0) && (
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Unidade — {selectedPav.nome}</p>
          <div className="flex flex-wrap gap-2">
            {unidadesDoPav(selectedPav.id).map(unid => {
              const prog = unidPct(unid.id)
              return (
                <Button key={unid.id} size="sm" variant={selectedUnid?.id === unid.id ? 'default' : 'outline'}
                  onClick={() => { setSelectedUnid(unid); setSelectedAmb(null) }}
                  className={cn(
                    prog?.nok && selectedUnid?.id !== unid.id && 'border-red-300 text-red-600',
                    prog?.pct === 100 && selectedUnid?.id !== unid.id && 'border-green-300 text-green-700'
                  )}>
                  {unid.nome}
                  {prog !== null && (
                    <span className={cn('ml-1.5 text-xs opacity-70', prog.pct === 100 && 'text-green-600')}>{prog.pct}%</span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Unidade-scoped items */}
      {selectedUnid && itensUnid.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-2.5 bg-green-50 border-b flex items-center gap-2">
            <Home className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">Verificações da Unidade — {selectedUnid.nome}</span>
          </div>
          <div className="divide-y">
            {itensUnid.map(item => {
              const key = unidKey(item, selectedUnid.id)
              const pav = pavimentos.find(p => p.id === selectedUnid.pavimento_id)!
              const insertData = { checklist_id: id, item_id: item.id, pavimento_id: pav.id, unidade_id: selectedUnid.id, ambiente_id: null, status: 'pendente' }
              return (
                <ItemRow key={item.id} item={item} exec={execMap.get(key)}
                  onStatus={s => upsertExec(key, insertData, { status: s })}
                  onNota={() => openNota(item, key, insertData)}
                  onPhoto={() => openPhoto(key, insertData)}
                  uploading={uploadingKey === key} />
              )
            })}
          </div>
        </div>
      )}

      {/* Ambiente selector + items */}
      {selectedUnid && itensAmb.length > 0 && (
        <>
          <div className="bg-white rounded-lg border p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Ambiente — {selectedUnid.nome}</p>
            <div className="flex flex-wrap gap-2">
              {ambientesDaUnid(selectedUnid.id).length === 0
                ? <p className="text-xs text-muted-foreground italic">Nenhum ambiente cadastrado nesta unidade.</p>
                : ambientesDaUnid(selectedUnid.id).map(amb => (
                  <Button key={amb.id} size="sm" variant={selectedAmb?.id === amb.id ? 'default' : 'outline'}
                    onClick={() => setSelectedAmb(amb)}>
                    {amb.nome}
                  </Button>
                ))
              }
            </div>
          </div>

          {selectedAmb && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-2.5 bg-purple-50 border-b flex items-center gap-2">
                <Grid3x3 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">Verificações do Ambiente — {selectedAmb.nome}</span>
              </div>
              <div className="divide-y">
                {itensAmb.map(item => {
                  const key = ambKey(item, selectedAmb.id)
                  const unid = unidades.find(u => u.id === selectedAmb.unidade_id)!
                  const pav = pavimentos.find(p => p.id === unid.pavimento_id)!
                  const insertData = { checklist_id: id, item_id: item.id, pavimento_id: pav.id, unidade_id: unid.id, ambiente_id: selectedAmb.id, status: 'pendente' }
                  return (
                    <ItemRow key={item.id} item={item} exec={execMap.get(key)}
                      onStatus={s => upsertExec(key, insertData, { status: s })}
                      onNota={() => openNota(item, key, insertData)}
                      onPhoto={() => openPhoto(key, insertData)}
                      uploading={uploadingKey === key} />
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Nota Dialog */}
      <Dialog open={notaDialog} onOpenChange={setNotaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nota — {notaItem?.nome}</DialogTitle></DialogHeader>
          <Textarea value={notaText} onChange={e => setNotaText(e.target.value)}
            placeholder="Descreva a situação encontrada..." rows={4} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotaDialog(false)}>Cancelar</Button>
            <Button onClick={saveNota} disabled={notaSaving}>
              {notaSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = '' }} />
    </div>
  )
}
