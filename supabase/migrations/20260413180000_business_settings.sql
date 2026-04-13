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

-- Misma lógica que BusinessContext: dueño en businesses.owner_id; empleado en employees.user_id
DROP POLICY IF EXISTS "Users can manage settings of their businesses" ON public.business_settings;
CREATE POLICY "Users can manage settings of their businesses" ON public.business_settings
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT e.business_id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND COALESCE(e.is_active, true) = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT e.business_id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND COALESCE(e.is_active, true) = true
    )
  );

COMMENT ON TABLE public.business_settings IS 'Configuraciones flexibles por negocio (ej. virtual_catalog en value JSON)';
