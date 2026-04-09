import * as React from 'react';
import { cn } from '../ui/utils';

type PageHeaderProps = {
  /** Desktop header (md+) */
  desktop?: React.ReactNode;
  /** Mobile header (<md) */
  mobile?: React.ReactNode;
  /** Extra content placed below headers (e.g. mobile search bar) */
  below?: React.ReactNode;
  className?: string;
};

export function PageHeader({ desktop, mobile, below, className }: PageHeaderProps) {
  return (
    <div className={cn(className)}>
      {desktop ? <div className="hidden md:block">{desktop}</div> : null}
      {mobile ? <div className="md:hidden">{mobile}</div> : null}
      {below}
    </div>
  );
}

