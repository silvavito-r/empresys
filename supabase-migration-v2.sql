-- ============================================
-- EmpreSys DB — Migration v2
-- Execute no Supabase Dashboard > SQL Editor
-- APÓS ter executado o supabase-schema.sql inicial
-- ============================================

-- 1. Adiciona campo "scope" nos itens do checklist
--    'unidade'   → verificação por unidade (padrão)
--    'pavimento' → verificação por pavimento (1 por andar)
--    'ambiente'  → verificação por ambiente dentro de cada unidade
ALTER TABLE checklist_itens
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'unidade'
  CHECK (scope IN ('pavimento', 'unidade', 'ambiente'));

-- 2. Adiciona ambiente_id nas execuções (nullable)
ALTER TABLE checklist_execucoes
  ADD COLUMN IF NOT EXISTS ambiente_id uuid REFERENCES ambientes(id) ON DELETE CASCADE;

-- 3. Torna unidade_id nullable (para itens de escopo pavimento)
ALTER TABLE checklist_execucoes
  ALTER COLUMN unidade_id DROP NOT NULL;

-- 4. Remove a unique constraint antiga
ALTER TABLE checklist_execucoes
  DROP CONSTRAINT IF EXISTS checklist_execucoes_checklist_id_item_id_unidade_id_key;

-- 5. Cria nova unique constraint que trata NULLs como iguais (PostgreSQL 15+)
--    Garante unicidade considerando que NULL = NULL para esse propósito
ALTER TABLE checklist_execucoes
  ADD CONSTRAINT checklist_execucoes_unique
  UNIQUE NULLS NOT DISTINCT (checklist_id, item_id, pavimento_id, unidade_id, ambiente_id);
