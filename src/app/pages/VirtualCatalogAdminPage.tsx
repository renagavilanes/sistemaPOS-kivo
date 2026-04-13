import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Download, LayoutGrid, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { useBusiness } from '../contexts/BusinessContext';
import type { OutOfStockMode, VirtualCatalogConfig } from '../lib/virtualCatalogTypes';
import {
  coerceVirtualCatalogConfig,
  defaultVirtualCatalogConfig,
  getVirtualCatalogSettingsRow,
  isCatalogSlugTaken,
  normalizeCatalogSlug,
  suggestSlugFromBusinessName,
  upsertVirtualCatalogSettings,
} from '../lib/virtualCatalogSettingsDb';

function RadioRow(props: {
  value: OutOfStockMode;
  current: OutOfStockMode;
  label: string;
  onPick: (v: OutOfStockMode) => void;
}) {
  const active = props.current === props.value;
  return (
    <button
      type="button"
      onClick={() => props.onPick(props.value)}
      className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors ${
        active ? 'border-[#272B36] bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      {props.label}
    </button>
  );
}

export default function VirtualCatalogAdminPage() {
  const navigate = useNavigate();
  const { currentBusiness: business } = useBusiness();

  const isOwner = business?.role === 'owner' || business?.permissions?.all === true;
  const canAccessSettings = isOwner || business?.permissions?.settings?.access === true;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<VirtualCatalogConfig>(defaultVirtualCatalogConfig());

  const publicUrl = useMemo(() => {
    const slug = normalizeCatalogSlug(cfg.slug);
    if (!slug) return '';
    if (typeof window === 'undefined') return `/catalogo/${slug}`;
    return `${window.location.origin}/catalogo/${slug}`;
  }, [cfg.slug]);

  useEffect(() => {
    if (!business?.id) return;
    if (!canAccessSettings) {
      toast.error('No tienes permiso para configurar el catálogo');
      navigate('/sales', { replace: true });
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const row = await getVirtualCatalogSettingsRow(business.id);
        const merged = coerceVirtualCatalogConfig(row.value);
        const next =
          merged.slug.trim().length > 0
            ? merged
            : defaultVirtualCatalogConfig({
                ...merged,
                slug: suggestSlugFromBusinessName(business.name || 'negocio'),
              });
        setCfg(next);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'No se pudo cargar la configuración');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [business?.id, business?.name, canAccessSettings, navigate]);

  const handleSave = async () => {
    if (!business?.id) return;

    const slug = normalizeCatalogSlug(cfg.slug);
    if (!slug) {
      toast.error('El slug es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const taken = await isCatalogSlugTaken({ slug, excludeBusinessId: business.id });
      if (taken) {
        toast.error('Ese slug ya está en uso. Elige otro.');
        setSaving(false);
        return;
      }

      const payload: VirtualCatalogConfig = {
        ...cfg,
        slug,
        delivery: {
          pickup: cfg.delivery.pickup,
          homeDelivery: cfg.delivery.homeDelivery,
          homeDeliveryFee: cfg.delivery.homeDelivery ? Number(cfg.delivery.homeDeliveryFee || 0) || 0 : 0,
        },
      };

      await upsertVirtualCatalogSettings(business.id, payload);
      setCfg(payload);
      toast.success('Catálogo guardado');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const downloadQrPng = async () => {
    if (!publicUrl) {
      toast.error('Primero define un slug válido');
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(publicUrl, {
        margin: 1,
        width: 900,
        errorCorrectionLevel: 'M',
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `catalogo-${normalizeCatalogSlug(cfg.slug) || 'qr'}.png`;
      a.click();
    } catch (e: any) {
      console.error(e);
      toast.error('No se pudo generar el QR');
    }
  };

  if (!business) return null;

  return (
    <div className="h-full overflow-auto bg-gray-50 pb-24 lg:pb-0">
      <PageHeader
        desktop={
          <div className="bg-white border-b px-6 py-4">
            <div className="w-full md:mx-auto md:max-w-3xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <LayoutGrid className="h-6 w-6 text-gray-800" />
                    Catálogo Virtual
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Comparte tu catálogo público y recibe pedidos por WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="bg-white border-b px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/more')}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Catálogo</h1>
            </div>
          </div>
        }
      />

      <div className="w-full space-y-4 p-4 md:mx-auto md:max-w-3xl md:p-6">
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-600">Cargando…</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-gray-900">Estado</div>
                  <div className="text-xs text-gray-600">Activa o desactiva el catálogo público</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{cfg.enabled ? 'Activo' : 'Inactivo'}</span>
                  <Switch
                    checked={cfg.enabled}
                    onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: Boolean(v) }))}
                  />
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-semibold">WhatsApp de pedidos</div>
                  <div className="mt-1 text-amber-900/90">
                    Los pedidos se enviarán al <span className="font-semibold">Teléfono del Negocio</span> configurado en{' '}
                    <Link to="/settings" className="underline font-semibold">
                      Configuración
                    </Link>
                    .
                  </div>
                  <div className="mt-2 text-sm">
                    Teléfono actual:{' '}
                    <span className="font-semibold">{business.phone?.trim() ? business.phone : '— (falta configurar)'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Slug del catálogo</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={cfg.slug}
                      onChange={(e) => setCfg((c) => ({ ...c, slug: e.target.value }))}
                      placeholder="mi-negocio"
                      className="h-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={() =>
                        setCfg((c) => ({
                          ...c,
                          slug: suggestSlugFromBusinessName(business.name || 'negocio'),
                        }))
                      }
                    >
                      Generar
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    URL pública:{' '}
                    <span className="font-mono text-gray-700">
                      {publicUrl || '/catalogo/(slug)'}
                    </span>
                  </p>
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                    La URL solo funciona para clientes después de pulsar <strong>Guardar</strong>. Si abres el catálogo antes,
                    el servidor responderá «Catálogo no encontrado».
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={downloadQrPng} disabled={!publicUrl}>
                    <QrCode className="h-4 w-4 mr-2" />
                    Descargar QR
                  </Button>
                  <Button type="button" variant="outline" asChild disabled={!publicUrl}>
                    <a href={publicUrl || '#'} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Abrir catálogo
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="text-base font-semibold text-gray-900">Productos sin stock</div>
                <div className="text-xs text-gray-600">Define cómo se muestran en el catálogo público</div>
              </div>
              <div className="p-4 grid gap-2">
                <RadioRow
                  value="show"
                  current={cfg.outOfStockMode}
                  label="Mostrar normalmente"
                  onPick={(v) => setCfg((c) => ({ ...c, outOfStockMode: v }))}
                />
                <RadioRow
                  value="hide"
                  current={cfg.outOfStockMode}
                  label="No mostrar en el catálogo"
                  onPick={(v) => setCfg((c) => ({ ...c, outOfStockMode: v }))}
                />
                <RadioRow
                  value="mark_unavailable"
                  current={cfg.outOfStockMode}
                  label="Mostrar como “No disponible”"
                  onPick={(v) => setCfg((c) => ({ ...c, outOfStockMode: v }))}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="text-base font-semibold text-gray-900">Métodos de entrega</div>
                <div className="text-xs text-gray-600">El cliente solo elige; tú defines reglas y costos</div>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Retiro en tienda</div>
                    <div className="text-xs text-gray-600">Permitir retiro</div>
                  </div>
                  <Switch
                    checked={cfg.delivery.pickup}
                    onCheckedChange={(v) => setCfg((c) => ({ ...c, delivery: { ...c.delivery, pickup: Boolean(v) } }))}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Entrega a domicilio</div>
                    <div className="text-xs text-gray-600">Permitir domicilio</div>
                  </div>
                  <Switch
                    checked={cfg.delivery.homeDelivery}
                    onCheckedChange={(v) =>
                      setCfg((c) => ({
                        ...c,
                        delivery: { ...c.delivery, homeDelivery: Boolean(v) },
                      }))
                    }
                  />
                </div>

                {cfg.delivery.homeDelivery && (
                  <div className="space-y-2">
                    <Label>Precio adicional por envío (opcional)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={String(cfg.delivery.homeDeliveryFee ?? 0)}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          delivery: { ...c.delivery, homeDeliveryFee: Number(e.target.value || 0) },
                        }))
                      }
                      className="h-10"
                    />
                    <p className="text-xs text-gray-500">El cliente lo verá sumado al total (no puede editarlo).</p>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden md:block">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="w-full md:w-auto bg-[#272B36] hover:bg-[#1f222b] h-11 rounded-xl"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="w-full bg-[#272B36] hover:bg-[#1f222b] h-12 rounded-xl"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
