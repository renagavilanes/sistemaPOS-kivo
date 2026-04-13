-- Catálogo virtual y otras configs por negocio (clave/valor JSON).
-- Idempotente: seguro ejecutar más de una vez.

CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, key)
);

CREATE INDEX IF NOT EXISTS idx_business_settings_business ON public.business_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_business_settings_category ON public.business_settings(business_id, category);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage settings of their businesses" ON public.business_settings;
CREATE POLICY "Users can manage settings of their businesses" ON public.business_settings
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_users WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.business_settings IS 'Configuraciones flexibles por negocio (ej. virtual_catalog en value JSON)';
