export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      clientes: {
        Row: Cliente
        Insert: ClienteInsert
        Update: Partial<ClienteInsert>
      }
      obras: {
        Row: Obra
        Insert: ObraInsert
        Update: Partial<ObraInsert>
      }
      pavimentos: {
        Row: Pavimento
        Insert: PavimentoInsert
        Update: Partial<PavimentoInsert>
      }
      unidades: {
        Row: Unidade
        Insert: UnidadeInsert
        Update: Partial<UnidadeInsert>
      }
      ambientes: {
        Row: Ambiente
        Insert: AmbienteInsert
        Update: Partial<AmbienteInsert>
      }
      checklists: {
        Row: Checklist
        Insert: ChecklistInsert
        Update: Partial<ChecklistInsert>
      }
      checklist_itens: {
        Row: ChecklistItem
        Insert: ChecklistItemInsert
        Update: Partial<ChecklistItemInsert>
      }
      checklist_execucoes: {
        Row: ChecklistExecucao
        Insert: ChecklistExecucaoInsert
        Update: Partial<ChecklistExecucaoInsert>
      }
    }
  }
}

// ---- Clientes ----
export interface Cliente {
  id: string
  nome: string
  cnpj: string | null
  endereco: string | null
  created_at: string
  created_by: string | null
}

export interface ClienteInsert {
  nome: string
  cnpj?: string | null
  endereco?: string | null
  created_by?: string | null
}

// ---- Obras ----
export interface Obra {
  id: string
  nome: string
  cliente_id: string | null
  endereco: string | null
  responsavel: string | null
  status: 'ativa' | 'concluida' | 'pausada'
  created_at: string
  created_by: string | null
}

export interface ObraInsert {
  nome: string
  cliente_id?: string | null
  endereco?: string | null
  responsavel?: string | null
  status?: 'ativa' | 'concluida' | 'pausada'
  created_by?: string | null
}

export interface ObraComCliente extends Obra {
  clientes: { nome: string } | null
}

// ---- Pavimentos ----
export interface Pavimento {
  id: string
  obra_id: string
  nome: string
  ordem: number
  created_at: string
}

export interface PavimentoInsert {
  obra_id: string
  nome: string
  ordem?: number
}

// ---- Unidades ----
export interface Unidade {
  id: string
  pavimento_id: string
  nome: string
  ordem: number
  created_at: string
}

export interface UnidadeInsert {
  pavimento_id: string
  nome: string
  ordem?: number
}

// ---- Ambientes ----
export interface Ambiente {
  id: string
  unidade_id: string
  nome: string
  created_at: string
}

export interface AmbienteInsert {
  unidade_id: string
  nome: string
}

// ---- Checklists ----
export interface Checklist {
  id: string
  obra_id: string
  nome: string
  descricao: string | null
  status: 'rascunho' | 'ativo' | 'concluido'
  created_at: string
  created_by: string | null
}

export interface ChecklistInsert {
  obra_id: string
  nome: string
  descricao?: string | null
  status?: 'rascunho' | 'ativo' | 'concluido'
  created_by?: string | null
}

export interface ChecklistComObra extends Checklist {
  obras: { nome: string; cliente_id: string | null } | null
}

// ---- Checklist Itens ----
export interface ChecklistItem {
  id: string
  checklist_id: string
  nome: string
  ordem: number
  created_at: string
}

export interface ChecklistItemInsert {
  checklist_id: string
  nome: string
  ordem?: number
}

// ---- Checklist Execuções ----
export type ExecucaoStatus = 'pendente' | 'ok' | 'nao_ok' | 'nao_aplicavel'

export interface ChecklistExecucao {
  id: string
  checklist_id: string
  item_id: string
  pavimento_id: string
  unidade_id: string
  status: ExecucaoStatus
  nota: string | null
  foto_url: string | null
  verificado_em: string | null
  verificado_por: string | null
  created_at: string
}

export interface ChecklistExecucaoInsert {
  checklist_id: string
  item_id: string
  pavimento_id: string
  unidade_id: string
  status?: ExecucaoStatus
  nota?: string | null
  foto_url?: string | null
  verificado_em?: string | null
  verificado_por?: string | null
}
