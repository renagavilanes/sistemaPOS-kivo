-- Comunicados del Super Admin: un aviso por usuario (se descarta una vez).
-- Ejecutar en el SQL Editor de Supabase o con supabase db push.

CREATE TABLE IF NOT EXISTS admin_comunicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  target_user_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_comunicados_created ON admin_comunicados (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_comunicado_dismissals (
  comunicado_id UUID NOT NULL REFERENCES admin_comunicados (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comunicado_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comunicado_dismissals_user ON admin_comunicado_dismissals (user_id);

ALTER TABLE admin_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_comunicado_dismissals ENABLE ROW LEVEL SECURITY;

-- El usuario solo ve comunicados donde es destinatario
CREATE POLICY "comunicados_select_if_targeted"
  ON admin_comunicados FOR SELECT TO authenticated
  USING (auth.uid() = ANY (target_user_ids));

-- Registrar cierre del modal (solo el propio usuario)
CREATE POLICY "comunicado_dismissals_insert_own"
  ON admin_comunicado_dismissals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "comunicado_dismissals_select_own"
  ON admin_comunicado_dismissals FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Permisos explícitos: PostgREST / service_role deben poder leer y escribir (RLS sigue aplicando a usuarios finales).
GRANT SELECT ON admin_comunicados TO authenticated;
GRANT SELECT, INSERT ON admin_comunicado_dismissals TO authenticated;
GRANT ALL ON admin_comunicados TO service_role;
GRANT ALL ON admin_comunicado_dismissals TO service_role;

-- Bucket para imágenes (subida vía Edge Function con service role).
-- Si falla el INSERT, créalo en Dashboard → Storage → New bucket → público lectura.
INSERT INTO storage.buckets (id, name, public)
VALUES ('comunicado-images', 'comunicado-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
