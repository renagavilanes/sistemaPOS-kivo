import * as React from 'react';
import { cn } from '../ui/utils';

type PageHeaderProps = {
  /** Desktop header */
  desktop?: React.ReactNode;
  /** Mobile / compact header */
  mobile?: React.ReactNode;
  /** Extra content placed below headers (e.g. mobile search bar) */
  below?: React.ReactNode;
  /** A partir de este breakpoint se muestra `desktop`. Por defecto md. */
  desktopFrom?: 'md' | 'lg';
  className?: string;
};

export function PageHeader({ desktop, mobile, below, desktopFrom = 'md', className }: PageHeaderProps) {
  const desktopCls = desktopFrom === 'lg' ? 'hidden lg:block' : 'hidden md:block';
  const mobileCls = desktopFrom === 'lg' ? 'lg:hidden' : 'md:hidden';
  return (
    <div className={cn(className)}>
      {desktop ? <div className={desktopCls}>{desktop}</div> : null}
      {mobile ? <div className={mobileCls}>{mobile}</div> : null}
      {below}
    </div>
  );
}

