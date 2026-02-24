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
      profiles: {
        Row: UserProfile
        Insert: UserProfileInsert
        Update: Partial<UserProfileInsert>
      }
      system_logs: {
        Row: SystemLog
        Insert: SystemLogInsert
        Update: Partial<SystemLogInsert>
      }
    }
  }
}

// ---- Clientes ----
export interface Cliente {
  id: string
  nome: string
  cnpj: string | null
  // address breakdown
  rua: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  // contact
  contato_nome: string | null
  contato_telefone: string | null
  contato_email: string | null
  // misc
  logo_url: string | null
  descricao: string | null
  // legacy field kept for backward compat
  endereco: string | null
  created_at: string
  created_by: string | null
}

export interface ClienteInsert {
  nome: string
  cnpj?: string | null
  rua?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  contato_nome?: string | null
  contato_telefone?: string | null
  contato_email?: string | null
  logo_url?: string | null
  descricao?: string | null
  endereco?: string | null
  created_by?: string | null
}

// ---- Obras ----
export interface Obra {
  id: string
  nome: string
  cliente_id: string | null
  // address breakdown
  rua: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  regiao: string | null
  // legacy field kept for backward compat
  endereco: string | null
  responsavel: string | null
  status: 'ativa' | 'concluida' | 'pausada'
  created_at: string
  created_by: string | null
}

export interface ObraInsert {
  nome: string
  cliente_id?: string | null
  rua?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  regiao?: string | null
  endereco?: string | null
  responsavel?: string | null
  status?: 'ativa' | 'concluida' | 'pausada'
  created_by?: string | null
}

export interface ObraComCliente extends Obra {
  clientes: { nome: string; logo_url: string | null } | null
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

export interface ChecklistComObraCompleta extends Checklist {
  obras: {
    nome: string
    endereco: string | null
    rua: string | null
    numero: string | null
    bairro: string | null
    cidade: string | null
    uf: string | null
    responsavel: string | null
    cliente_id: string | null
    clientes: { nome: string; logo_url: string | null } | null
  } | null
}

// ---- Checklist Itens ----
export type ItemScope = 'pavimento' | 'unidade' | 'ambiente'

export interface ChecklistItem {
  id: string
  checklist_id: string
  nome: string
  ordem: number
  scope: ItemScope
  created_at: string
}

export interface ChecklistItemInsert {
  checklist_id: string
  nome: string
  ordem?: number
  scope?: ItemScope
}

// ---- Checklist Execuções ----
export type ExecucaoStatus = 'pendente' | 'ok' | 'nao_ok' | 'nao_aplicavel'

export interface ChecklistExecucao {
  id: string
  checklist_id: string
  item_id: string
  pavimento_id: string
  unidade_id: string | null
  ambiente_id: string | null
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
  unidade_id?: string | null
  ambiente_id?: string | null
  status?: ExecucaoStatus
  nota?: string | null
  foto_url?: string | null
  verificado_em?: string | null
  verificado_por?: string | null
}

// ---- Profiles ----
export type UserRole = 'administrador' | 'engenharia' | 'rh'

export interface UserProfile {
  id: string
  user_id: string
  nome: string
  email: string | null
  role: UserRole
  descricao: string | null
  active: boolean
  created_at: string
}

export interface UserProfileInsert {
  user_id: string
  nome: string
  email?: string | null
  role?: UserRole
  descricao?: string | null
  active?: boolean
}

// ---- System Logs ----
export interface SystemLog {
  id: string
  action: string
  user_id: string | null
  user_email: string | null
  details: Json | null
  created_at: string
}

export interface SystemLogInsert {
  action: string
  user_id?: string | null
  user_email?: string | null
  details?: Json | null
}
