-- Si ya creaste las tablas antes sin GRANT, ejecuta solo esto (o vuelve a correr el bloque GRANT del otro archivo).

GRANT SELECT ON public.admin_comunicados TO authenticated;
GRANT SELECT, INSERT ON public.admin_comunicado_dismissals TO authenticated;
GRANT ALL ON public.admin_comunicados TO service_role;
GRANT ALL ON public.admin_comunicado_dismissals TO service_role;
