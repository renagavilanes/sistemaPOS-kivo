import { Link } from 'react-router';
import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  CreditCard,
  Layers,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { Button } from '../components/ui/button';
import { LandingFxOverlay } from '../components/landing/LandingFxOverlay';

type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  shortDescription?: string;
};

type Plan = {
  name: string;
  priceLabel: string;
  description: string;
  highlights: string[];
  ctaLabel: string;
  ctaHref: string;
  emphasized?: boolean;
};

function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>;
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
          <Sparkles className="h-4 w-4 text-[var(--brand)]" />
          <span>{eyebrow}</span>
        </div>
      ) : null}
      <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-pretty text-sm text-white/70 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

function GlowBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[var(--brand)]/25 blur-[110px]" />
      <div className="absolute -bottom-32 right-[-120px] h-[520px] w-[520px] rounded-full bg-violet-500/15 blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(47,128,255,0.18),transparent_60%)]" />
    </div>
  );
}

function Mockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-white/0 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>
          <div className="hidden text-xs text-white/60 sm:block">Kivo • POS</div>
          <div className="h-7 w-20 rounded-md border border-white/10 bg-white/5" />
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-12 sm:gap-5 sm:p-5">
          <div className="sm:col-span-4">
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="h-8 w-28 rounded bg-[var(--brand)]/25" />
              <div className="h-3 w-40 rounded bg-white/10" />
              <div className="h-3 w-32 rounded bg-white/10" />
              <div className="mt-1 h-9 w-full rounded-lg bg-white/5" />
            </div>
          </div>
          <div className="sm:col-span-8">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`mock-card-${i}`}
                  className={[
                    'rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4 transition-transform duration-300 hover:-translate-y-0.5',
                    // En móvil mostramos 2 cards para que el mockup no sea tan alto.
                    i >= 2 ? 'hidden sm:block' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-16 sm:w-24 rounded bg-white/10" />
                    <div className="h-7 w-7 rounded-lg bg-white/5" />
                  </div>
                  <div className="mt-3 sm:mt-4 h-6 w-12 sm:w-16 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-20 sm:w-28 rounded bg-white/10" />
                  <div className="mt-4 sm:mt-5 h-9 w-full rounded-lg bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-white/50 sm:text-xs">Mockup ilustrativo (placeholder).</p>
    </div>
  );
}

function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((f) => (
        <div
          key={f.title}
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05]"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brand)] transition-transform duration-300 group-hover:-translate-y-0.5">
            {f.icon}
          </div>
          <h3 className="mt-4 text-sm font-semibold text-white">{f.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{f.description}</p>
        </div>
      ))}
    </div>
  );
}

function BenefitsBento({ items }: { items: Feature[] }) {
  const [first, ...rest] = items;
  return (
    <div className="mt-6 sm:mt-8 grid gap-4 lg:grid-cols-12">
      {first ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:col-span-6">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--brand)]/20 blur-[90px]" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brand)]">
                {first.icon}
              </div>
              <div className="text-xs text-white/60">Beneficio principal</div>
            </div>
            <h3 className="mt-4 text-base sm:text-lg font-semibold text-white">{first.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              {first.shortDescription ? (
                <>
                  <span className="sm:hidden">{first.shortDescription}</span>
                  <span className="hidden sm:block">{first.description}</span>
                </>
              ) : (
                first.description
              )}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-sm font-semibold text-white">Más claridad</div>
                <div className="mt-1 text-xs text-white/60">Decisiones rápidas con información limpia.</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-sm font-semibold text-white">Menos fricción</div>
                <div className="mt-1 text-xs text-white/60">Operación diaria sin pasos innecesarios.</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* En móvil: 2 columnas para que no sea “todo hacia abajo” */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-6">
        {rest.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brand)] transition-transform duration-300 group-hover:-translate-y-0.5">
                {f.icon}
              </div>
              <div className="hidden sm:block h-8 w-20 rounded-lg border border-white/10 bg-white/[0.02]" />
            </div>
            <h3 className="mt-3 text-[13px] font-semibold leading-snug text-white sm:mt-4 sm:text-sm">
              {f.title}
            </h3>
            <p className="mt-1.5 text-[12px] leading-snug text-white/65 sm:mt-2 sm:text-sm sm:leading-relaxed sm:text-white/70">
              {f.shortDescription ? (
                <>
                  <span className="sm:hidden">{f.shortDescription}</span>
                  <span className="hidden sm:block">{f.description}</span>
                </>
              ) : (
                f.description
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunctionalityNarrative({ items }: { items: Feature[] }) {
  return (
    <div className="mt-6 sm:mt-8 grid gap-6 sm:gap-8 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="text-xs font-medium text-white/60">Flujo de trabajo</div>
          <h3 className="mt-2 text-base sm:text-lg font-semibold text-white">
            Opera en minutos, entiende en segundos
          </h3>
          <p className="mt-2 text-sm text-white/70">
            Kivo está pensado para el día a día: registrar, filtrar, revisar y cerrar caja sin perder tiempo.
          </p>

          <ol className="mt-5 space-y-4">
            {items.slice(0, 3).map((f, idx) => (
              <li key={f.title} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-semibold text-white/80">
                  {idx + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <div className="mt-1 text-sm text-white/65">
                    {f.shortDescription ? (
                      <>
                        <span className="sm:hidden">{f.shortDescription}</span>
                        <span className="hidden sm:block">{f.description}</span>
                      </>
                    ) : (
                      f.description
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="lg:col-span-7">
        {/* En móvil mostramos 2 columnas compactas para dar más “ritmo” */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2">
          {items.map((f, i) => (
            <div
              key={f.title}
              className={[
                'relative overflow-hidden rounded-2xl border bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.05]',
                i % 3 === 0 ? 'border-[var(--brand)]/30' : 'border-white/10',
              ].join(' ')}
            >
              {i % 3 === 0 ? (
                <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--brand)]/16 blur-[90px]" />
              ) : null}
              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brand)]">
                    {f.icon}
                  </div>
                  <div className="hidden sm:block text-xs text-white/55">Funcionalidad</div>
                </div>
                <h3 className="mt-3 text-[13px] font-semibold leading-snug text-white sm:mt-4 sm:text-sm">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-snug text-white/65 sm:mt-2 sm:text-sm sm:leading-relaxed sm:text-white/70">
                  {f.shortDescription ? (
                    <>
                      <span className="sm:hidden">{f.shortDescription}</span>
                      <span className="hidden sm:block">{f.description}</span>
                    </>
                  ) : (
                    f.description
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-3">
      {plans.map((p) => (
        <div
          key={p.name}
          className={[
            'relative rounded-2xl border bg-white/[0.03] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]',
            p.emphasized ? 'border-[var(--brand)]/50 ring-1 ring-[var(--brand)]/35' : 'border-white/10',
          ].join(' ')}
        >
          {p.emphasized ? (
            <div className="absolute -top-3 left-6 inline-flex items-center rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/20 px-3 py-1 text-xs font-semibold text-white">
              Recomendado
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">{p.name}</h3>
              <p className="mt-1 text-sm text-white/70">{p.description}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-white">{p.priceLabel}</div>
              <div className="text-xs text-white/50">por mes</div>
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {p.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-white/75">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5 text-[var(--brand)]">
                  <Check className="h-4 w-4" />
                </span>
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {p.ctaLabel.toLowerCase().includes('próxim') ? (
              <Button
                type="button"
                disabled
                className="w-full bg-white/10 text-white/70 cursor-not-allowed hover:bg-white/10"
              >
                {p.ctaLabel}
              </Button>
            ) : (
              <Button
                asChild
                className={[
                  'w-full',
                  p.emphasized
                    ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90'
                    : 'bg-white/10 text-white hover:bg-white/15',
                ].join(' ')}
              >
                <a href={p.ctaHref} target={p.ctaHref.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  {p.ctaLabel}
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const benefits: Feature[] = [
    {
      icon: <Layers className="h-5 w-5" />,
      title: 'Todo en un solo lugar',
      description: 'Ventas, gastos, inventario, empleados y contactos sin saltar entre herramientas.',
      shortDescription: 'Ventas, gastos e inventario en un solo lugar.',
    },
    {
      icon: <Wallet className="h-5 w-5" />,
      title: 'Control total de tu dinero',
      description: 'Resumen claro de ingresos, egresos y ganancia para decidir rápido.',
      shortDescription: 'Ingresos, egresos y ganancia claros.',
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: 'Historial claro de movimientos',
      description: 'Filtra por fechas, cliente, empleado y estado de pago en segundos.',
      shortDescription: 'Filtra movimientos en segundos.',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: 'Empleados y permisos',
      description: 'Asigna roles y mantén el control sin complicaciones.',
      shortDescription: 'Roles y control para tu equipo.',
    },
  ];

  const functionalities: Feature[] = [
    {
      icon: <CreditCard className="h-5 w-5" />,
      title: 'Ventas rápidas con múltiples métodos de pago',
      description: 'Cobra en segundos y registra la operación con nota, comprador y estado de pago.',
      shortDescription: 'Cobra rápido y registra todo.',
    },
    {
      icon: <BriefcaseBusiness className="h-5 w-5" />,
      title: 'Control de gastos por categoría',
      description: 'Ordena tus egresos para entender exactamente en qué se va el dinero.',
      shortDescription: 'Ordena egresos por categoría.',
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: 'Movimientos filtrables (historial)',
      description: 'Encuentra cualquier venta o gasto sin perder tiempo.',
      shortDescription: 'Encuentra movimientos rápido.',
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: 'Gestión de empleados',
      description: 'Invita, administra y controla accesos para tu equipo.',
      shortDescription: 'Invita y controla accesos.',
    },
    {
      icon: <Layers className="h-5 w-5" />,
      title: 'Inventario simple',
      description: 'Mantén tu catálogo y existencias organizadas para vender con confianza.',
      shortDescription: 'Catálogo y stock organizados.',
    },
  ];

  const plans: Plan[] = [
    {
      name: 'Gratuito',
      priceLabel: '$0',
      description: 'Para empezar y probar Kivo sin riesgo.',
      highlights: ['Hasta 3 negocios', 'Hasta 3 empleados por negocio', 'Hasta 20 ventas/gastos diarios', 'Acceso a funciones básicas'],
      ctaLabel: 'Empezar gratis',
      ctaHref: '/register',
    },
    {
      name: 'Kivo Pro',
      priceLabel: 'Próximamente',
      description: 'Más potencia para crecer con control y fluidez.',
      highlights: ['Hasta 5 negocios', 'Hasta 10 empleados por negocio', 'Transacciones ilimitadas', 'Mejor rendimiento y control'],
      ctaLabel: 'Próximamente',
      ctaHref: '#planes',
      emphasized: true,
    },
    {
      name: 'Personalizado',
      priceLabel: 'Hablemos',
      description: 'Soluciones a medida para operaciones únicas.',
      highlights: ['Soluciones a medida', 'Integraciones', 'Soporte directo'],
      ctaLabel: 'Contactar por WhatsApp',
      ctaHref: 'https://wa.me/593958808548',
    },
  ];

  return (
    <div className="dark min-h-screen bg-[#070A12] text-white">
      <div className="relative">
        <LandingFxOverlay enableCursor={false} />
        <GlowBackground />

        <header className="relative">
          <Container>
            <div className="flex items-center justify-between py-5" data-fx-reveal style={{ ['--reveal-delay' as any]: '0ms' }}>
              <Link to="/" className="inline-flex items-center gap-3">
                <BrandLogo iconClassName="h-10" />
              </Link>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" className="text-white/80 hover:text-white">
                  <Link to="/login">Iniciar sesión</Link>
                </Button>
                <Button asChild className="bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90" data-fx-ripple>
                  <Link to="/register">Crear cuenta</Link>
                </Button>
              </div>
            </div>
          </Container>
        </header>

        <main className="relative">
          {/* HERO */}
          <section className="pt-8 sm:pt-14 lg:pt-16">
            <Container>
              <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-12">
                <div className="lg:col-span-6">
                  <div data-fx-reveal style={{ ['--reveal-delay' as any]: '80ms' }} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                    POS moderno para negocios reales
                  </div>
                  <h1 data-fx-reveal style={{ ['--reveal-delay' as any]: '160ms' }} className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:mt-5 sm:text-5xl">
                    Controla tu negocio sin complicaciones
                  </h1>
                  <p data-fx-reveal style={{ ['--reveal-delay' as any]: '240ms' }} className="mt-3 text-pretty text-sm text-white/70 sm:mt-4 sm:text-lg">
                    Ventas, gastos, inventario y empleados en un solo lugar.
                  </p>

                  {/* En móvil: CTAs en el mismo nivel (2 columnas). */}
                  <div data-fx-reveal style={{ ['--reveal-delay' as any]: '320ms' }} className="mt-5 grid grid-cols-2 gap-3 sm:mt-7 sm:flex sm:flex-row sm:items-center">
                    <Button
                      asChild
                      className="h-11 w-full bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 sm:w-auto"
                      data-fx-ripple
                    >
                      <Link to="/register">Crear cuenta</Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-11 w-full border-white/15 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                      data-fx-ripple
                    >
                      <Link to="/login">Iniciar sesión</Link>
                    </Button>
                    <a href="#planes" className="col-span-2 text-sm text-white/70 hover:text-white sm:col-auto sm:ml-2">
                      Ver planes
                    </a>
                  </div>

                  {/* En móvil: 3 en el mismo nivel (compacto). */}
                  <div data-fx-reveal style={{ ['--reveal-delay' as any]: '420ms' }} className="mt-5 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                      <div className="text-[13px] font-semibold sm:text-sm">Rápido</div>
                      <div className="mt-1 text-[11px] leading-snug text-white/60 sm:text-xs">
                        Sin fricción.
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                      <div className="text-[13px] font-semibold sm:text-sm">Claro</div>
                      <div className="mt-1 text-[11px] leading-snug text-white/60 sm:text-xs">
                        Todo entendible.
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                      <div className="text-[13px] font-semibold sm:text-sm">Escalable</div>
                      <div className="mt-1 text-[11px] leading-snug text-white/60 sm:text-xs">
                        Crece contigo.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="mx-auto w-full max-w-[560px] lg:max-w-none">
                    <div data-fx-reveal style={{ ['--reveal-delay' as any]: '260ms' }}>
                      <Mockup />
                    </div>
                  </div>
                </div>
              </div>
            </Container>
          </section>

          {/* BENEFICIOS */}
          <section className="mt-12 sm:mt-20">
            <Container>
              <div data-fx-reveal>
                <SectionHeading
                eyebrow="Beneficios"
                title="Una base sólida para administrar sin estrés"
                subtitle="Kivo reúne lo esencial del día a día: vender, controlar gastos, gestionar inventario y equipo, y entender tus números."
              />
              </div>
              <div data-fx-reveal style={{ ['--reveal-delay' as any]: '120ms' }}>
                <BenefitsBento items={benefits} />
              </div>
            </Container>
          </section>

          {/* FUNCIONALIDADES */}
          <section className="mt-12 sm:mt-20">
            <Container>
              <div data-fx-reveal>
                <SectionHeading
                eyebrow="Funcionalidades"
                title="Herramientas simples. Resultados potentes."
                subtitle="Todo lo que necesitas para operar rápido, con orden y con claridad."
              />
              </div>
              <div data-fx-reveal style={{ ['--reveal-delay' as any]: '120ms' }}>
                <FunctionalityNarrative items={functionalities} />
              </div>
            </Container>
          </section>

          {/* PLANES */}
          <section id="planes" className="mt-12 scroll-mt-24 sm:mt-20">
            <Container>
              <div data-fx-reveal>
                <SectionHeading
                eyebrow="Planes"
                title="Elige el plan que se adapta a tu ritmo"
                subtitle="Empieza gratis y evoluciona cuando tu operación lo necesite. El plan Pro es ideal para equipos y múltiples negocios."
              />
              </div>
              <div data-fx-reveal style={{ ['--reveal-delay' as any]: '120ms' }}>
                <PlanCards plans={plans} />
              </div>
              <p className="mt-4 text-xs text-white/50">
                Nota: precios referenciales. Puedes ajustar estos valores cuando definas tu estrategia final.
              </p>
            </Container>
          </section>

          {/* CTA FINAL */}
          <section className="mt-12 sm:mt-20">
            <Container>
              <div data-fx-reveal className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-8 sm:p-10">
                <div aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--brand)]/20 blur-[90px]" />
                <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-balance text-2xl font-semibold text-white">
                      Empieza a organizar tu negocio hoy
                    </h3>
                    <p className="mt-2 text-sm text-white/70">
                      Crea tu cuenta y configura tu primer negocio en minutos.
                    </p>
                  </div>
                  <Button asChild className="h-11 bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90" data-fx-ripple>
                    <Link to="/register">Crear cuenta gratis</Link>
                  </Button>
                </div>
              </div>
            </Container>
          </section>

          {/* FOOTER */}
          <footer className="mt-12 border-t border-white/10 py-10">
            <Container>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <BrandLogo iconClassName="h-9" />
                  <span className="text-xs text-white/50">© {new Date().getFullYear()} Kivo</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
                  <Link className="hover:text-white" to="/login">
                    Iniciar sesión
                  </Link>
                  <Link className="hover:text-white" to="/register">
                    Crear cuenta
                  </Link>
                  <a className="hover:text-white" href="#planes">
                    Planes
                  </a>
                </div>
              </div>
            </Container>
          </footer>
        </main>
      </div>
    </div>
  );
}

