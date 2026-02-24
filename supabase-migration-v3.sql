-- ============================================================
-- EmpreSys — Migration v3
-- Executar no Supabase SQL Editor
-- ============================================================

-- ---- Clientes: novos campos de endereço e contato ----
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS rua text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contato_nome text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contato_telefone text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contato_email text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS descricao text;

-- ---- Obras: novos campos de endereço e região ----
ALTER TABLE obras ADD COLUMN IF NOT EXISTS rua text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS regiao text;

-- ---- Perfis de usuários ----
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  email text,
  role text DEFAULT 'engenharia' CHECK (role IN ('administrador', 'engenharia', 'rh')),
  descricao text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Authenticated users can manage profiles'
  ) THEN
    CREATE POLICY "Authenticated users can manage profiles"
      ON profiles FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ---- Logs do sistema ----
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  user_id uuid,
  user_email text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_logs'
      AND policyname = 'Authenticated users can manage logs'
  ) THEN
    CREATE POLICY "Authenticated users can manage logs"
      ON system_logs FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ---- Bucket de logos (executar separado no Storage) ----
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos-clientes', 'logos-clientes', true)
-- ON CONFLICT DO NOTHING;
