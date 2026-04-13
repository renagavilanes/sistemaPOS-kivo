import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, LayoutGrid, QrCode, Share2 } from 'lucide-react';
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
  /** Hay fila en business_settings: el enlace público ya existe en el servidor */
  const [catalogPublished, setCatalogPublished] = useState(false);

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
        setCatalogPublished(Boolean(row.id));
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'No se pudo cargar la configuración');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [business?.id, business?.name, canAccessSettings, navigate]);

  const resolveSlugForSave = async (): Promise<string | null> => {
    if (!business?.id) return null;
    let slug = normalizeCatalogSlug(cfg.slug);
    if (!slug) {
      slug = suggestSlugFromBusinessName(business.name || 'negocio');
    }
    if (!slug) return null;

    const taken = await isCatalogSlugTaken({ slug, excludeBusinessId: business.id });
    if (taken) {
      const suffix = (business.id || '').replace(/-/g, '').slice(0, 6);
      slug = `${slug}-${suffix}`;
    }
    return slug;
  };

  const handleSave = async () => {
    if (!business?.id) return;

    setSaving(true);
    try {
      const slug = await resolveSlugForSave();
      if (!slug) {
        toast.error('No se pudo generar el enlace del catálogo. Revisa el nombre del negocio.');
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
      setCatalogPublished(true);
      toast.success('Cambios guardados');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const shareQrPng = async () => {
    if (!catalogPublished || !publicUrl) {
      toast.error('Guarda la configuración abajo para publicar el catálogo y poder compartirlo.');
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(publicUrl, {
        margin: 1,
        width: 900,
        errorCorrectionLevel: 'M',
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const name = `qr-catalogo-${normalizeCatalogSlug(cfg.slug) || 'tienda'}.png`;
      const file = new File([blob], name, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'QR del catálogo',
          text: `Escanea para abrir el catálogo.\n${publicUrl}`,
        });
        return;
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = name;
      a.click();
      toast.message('Tu dispositivo no tiene menú compartir para imágenes; se descargó el QR.');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error(e);
      toast.error('No se pudo compartir el QR');
    }
  };

  const shareCatalogLink = async () => {
    if (!catalogPublished || !publicUrl) {
      toast.error('Guarda la configuración abajo para publicar el catálogo y poder compartirlo.');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: business?.name ? `Catálogo — ${business.name}` : 'Catálogo',
          text: 'Mira nuestro catálogo',
          url: publicUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Enlace copiado');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error(e);
      toast.error('No se pudo compartir el enlace');
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
            <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 space-y-4 shadow-sm">
              <p className="text-sm text-gray-600 leading-relaxed">
                Productos y precios del catálogo público se actualizan solos con tu inventario. Aquí compartes el acceso y
                ajustas cómo se ve la tienda.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => void shareQrPng()}
                  disabled={!catalogPublished || !publicUrl}
                  className="h-12 rounded-xl bg-[#272B36] hover:bg-[#1f222b] text-white shadow-sm"
                >
                  <QrCode className="h-5 w-5 mr-2 shrink-0" />
                  Compartir QR
                </Button>
                <Button
                  type="button"
                  onClick={() => void shareCatalogLink()}
                  disabled={!catalogPublished || !publicUrl}
                  className="h-12 rounded-xl bg-[#272B36] hover:bg-[#1f222b] text-white shadow-sm"
                >
                  <Share2 className="h-5 w-5 mr-2 shrink-0" />
                  Compartir catálogo
                </Button>
              </div>
              {(!catalogPublished || !publicUrl) && (
                <p className="text-xs text-gray-500">
                  Cuando guardes por primera vez en <strong>Configuración</strong>, podrás compartir el QR y el enlace.
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-gray-900">Catálogo público</div>
                  <div className="text-xs text-gray-600">Visible para clientes sin iniciar sesión</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-gray-700 hidden sm:inline">{cfg.enabled ? 'Activo' : 'Inactivo'}</span>
                  <Switch
                    checked={cfg.enabled}
                    onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: Boolean(v) }))}
                  />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="catalog-whatsapp-phone">WhatsApp para recibir pedidos</Label>
                  <Input
                    id="catalog-whatsapp-phone"
                    readOnly
                    value={business.phone?.trim() || ''}
                    placeholder="Sin número — configúralo en Configuración"
                    className="h-10 bg-gray-50 text-gray-900 border-gray-200 cursor-default"
                  />
                  <p className="text-xs text-gray-500">
                    Los pedidos del catálogo se envían a este número. Para cambiarlo, ve a{' '}
                    <Link to="/settings" className="text-[#272B36] font-medium underline underline-offset-2">
                      Configuración
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 px-0.5">Configuración</h2>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="text-base font-semibold text-gray-900">Productos sin stock</div>
                  <div className="text-xs text-gray-600">Cómo se muestran en el catálogo público</div>
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

                <div className="px-4 py-3 border-t border-b bg-gray-50">
                  <div className="text-base font-semibold text-gray-900">Métodos de entrega</div>
                  <div className="text-xs text-gray-600">El cliente elige; tú defines reglas y costos</div>
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
                      <p className="text-xs text-gray-500">El cliente lo verá sumado al total.</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t bg-gray-50/80">
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="w-full sm:w-auto bg-[#272B36] hover:bg-[#1f222b] h-11 rounded-xl"
                  >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="hidden md:block h-2" aria-hidden />
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
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
