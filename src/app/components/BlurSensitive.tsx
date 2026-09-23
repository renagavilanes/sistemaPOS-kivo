import type { ReactNode } from 'react';

/** Muestra un valor sensible desenfocado, sin dejar el número real en el DOM. */
export function BlurSensitive({
  hidden,
  children,
  placeholder = '$88,88',
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
      className={`inline-flex max-w-full align-middle blur-[8px] select-none pointer-events-none ${className}`}
      aria-hidden
    >
      {placeholder}
    </span>
  );
}
