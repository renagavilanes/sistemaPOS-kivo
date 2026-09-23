import type { ReactNode } from 'react';

/** Oculta un valor sensible con un guion, sin romper el layout ni dejar el número en el DOM. */
export function BlurSensitive({
  hidden,
  children,
  placeholder = '—',
  className = '',
}: {
  hidden: boolean;
  children: ReactNode;
  placeholder?: ReactNode;
  className?: string;
}) {
  if (!hidden) return <>{children}</>;
  return (
    <span
      className={`inline-flex items-center text-gray-400 select-none ${className}`}
      aria-hidden
    >
      {placeholder}
    </span>
  );
}
