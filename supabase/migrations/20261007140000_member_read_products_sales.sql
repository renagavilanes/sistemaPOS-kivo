-- Lectura directa para el empleado activo de su negocio.
-- No cambia insert, update ni delete: crear venta, editar movimiento y guardar producto siguen en la función.

DROP POLICY IF EXISTS "Employees can view products of their businesses" ON public.products;
CREATE POLICY "Employees can view products of their businesses"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT e.business_id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND COALESCE(e.is_active, true) = true
    )
  );

DROP POLICY IF EXISTS "Employees can view sales of their businesses" ON public.sales;
CREATE POLICY "Employees can view sales of their businesses"
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT e.business_id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND COALESCE(e.is_active, true) = true
    )
  );
