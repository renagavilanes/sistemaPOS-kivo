import { cn } from './ui/utils';

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
};

/** Kivo brand logo from user-provided reference image. */
export function BrandLogo({
  className,
  iconClassName,
  showText = true,
}: BrandLogoProps) {
  const lightLogoSrc = '/branding/kivo-logo-reference.png';
  // Logo optimizado para fondos oscuros (texto blanco), provisto por el usuario.
  const darkLogoSrc = '/branding/kivo-logo-dark.png';

  return (
    <div className={cn('inline-flex items-center', className)}>
      <img
        src={lightLogoSrc}
        alt="Kivo"
        className={cn(
          showText ? 'h-9 w-auto max-w-[220px]' : 'h-12 w-auto max-w-[260px]',
          'object-contain select-none pointer-events-none dark:hidden',
          iconClassName,
        )}
      />
      <img
        src={darkLogoSrc}
        alt="Kivo"
        className={cn(
          showText ? 'h-9 w-auto max-w-[220px]' : 'h-12 w-auto max-w-[260px]',
          // El PNG dark tiene fondo negro "quemado". En fondos oscuros,
          // `mix-blend-screen` hace que el negro se funda con el background.
          'object-contain select-none pointer-events-none hidden dark:block dark:mix-blend-screen',
          iconClassName,
        )}
      />
    </div>
  );
}

