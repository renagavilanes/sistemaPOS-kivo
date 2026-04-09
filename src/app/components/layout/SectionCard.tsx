import * as React from 'react';
import { cn } from '../ui/utils';

type SectionCardProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

/** Shared white card wrapper (keeps spacing consistent). */
export function SectionCard({ className, padded = true, ...props }: SectionCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-300/90 shadow-[var(--shadow-card)]',
        padded ? 'p-4' : undefined,
        className,
      )}
      {...props}
    />
  );
}

