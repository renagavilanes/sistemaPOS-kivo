import * as React from 'react';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../ui/utils';

type TabDef = {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  hidden?: boolean;
};

type PrimaryTabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  tabs: TabDef[];
  className?: string;
  listClassName?: string;
};

export function PrimaryTabs({
  value,
  onValueChange,
  tabs,
  className,
  listClassName,
}: PrimaryTabsProps) {
  const visibleTabs = tabs.filter((t) => !t.hidden);
  const colsClass =
    visibleTabs.length === 1
      ? 'grid-cols-1'
      : visibleTabs.length === 2
        ? 'grid-cols-2'
        : visibleTabs.length === 3
          ? 'grid-cols-3'
          : 'grid-cols-4';

  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList className={cn('grid w-full', colsClass, listClassName)}>
        {visibleTabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="gap-2">
            {t.icon}
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

