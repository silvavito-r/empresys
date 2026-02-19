-- ============================================
-- EmpreSys DB — Schema SQL
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================

-- Clientes (construtoras)
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  endereco text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Obras
create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente_id uuid references clientes(id) on delete cascade,
  endereco text,
  responsavel text,
  status text default 'ativa' check (status in ('ativa', 'concluida', 'pausada')),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Pavimentos
create table if not exists pavimentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  ordem int default 0,
  created_at timestamptz default now()
);

-- Unidades
create table if not exists unidades (
  id uuid primary key default gen_random_uuid(),
  pavimento_id uuid not null references pavimentos(id) on delete cascade,
  nome text not null,
  ordem int default 0,
  created_at timestamptz default now()
);

-- Ambientes
create table if not exists ambientes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidades(id) on delete cascade,
  nome text not null,
  created_at timestamptz default now()
);

-- Checklists
create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  descricao text,
  status text default 'rascunho' check (status in ('rascunho', 'ativo', 'concluido')),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Itens do checklist
create table if not exists checklist_itens (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  nome text not null,
  ordem int default 0,
  created_at timestamptz default now()
);

-- Execuções (status de cada item por unidade)
create table if not exists checklist_execucoes (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  item_id uuid not null references checklist_itens(id) on delete cascade,
  pavimento_id uuid not null references pavimentos(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  status text default 'pendente' check (status in ('pendente', 'ok', 'nao_ok', 'nao_aplicavel')),
  nota text,
  foto_url text,
  verificado_em timestamptz,
  verificado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique(checklist_id, item_id, unidade_id)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

alter table clientes enable row level security;
alter table obras enable row level security;
alter table pavimentos enable row level security;
alter table unidades enable row level security;
alter table ambientes enable row level security;
alter table checklists enable row level security;
alter table checklist_itens enable row level security;
alter table checklist_execucoes enable row level security;

-- Políticas: usuários autenticados têm acesso total (MVP)
create policy "auth_all" on clientes for all to authenticated using (true) with check (true);
create policy "auth_all" on obras for all to authenticated using (true) with check (true);
create policy "auth_all" on pavimentos for all to authenticated using (true) with check (true);
create policy "auth_all" on unidades for all to authenticated using (true) with check (true);
create policy "auth_all" on ambientes for all to authenticated using (true) with check (true);
create policy "auth_all" on checklists for all to authenticated using (true) with check (true);
create policy "auth_all" on checklist_itens for all to authenticated using (true) with check (true);
create policy "auth_all" on checklist_execucoes for all to authenticated using (true) with check (true);

-- ============================================
-- Storage: bucket para fotos do checklist
-- ============================================

-- Execute no Supabase Dashboard > Storage > New Bucket
-- Nome: checklist-fotos
-- Public bucket: SIM (para exibir fotos diretamente)

-- OU via SQL:
insert into storage.buckets (id, name, public)
values ('checklist-fotos', 'checklist-fotos', true)
on conflict (id) do nothing;

-- Política de storage para usuários autenticados
create policy "auth_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'checklist-fotos');

create policy "auth_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'checklist-fotos');

create policy "public_select" on storage.objects
  for select to anon
  using (bucket_id = 'checklist-fotos');
