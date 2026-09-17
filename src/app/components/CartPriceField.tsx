import { useEffect, useRef, useState } from 'react';
import { Input } from './ui/input';
import { parseLocaleNumber } from '../utils/currency';

/** Precio en el carrito: el texto se guarda al salir, para poder escribir 3,94 o 3.94. */
export function CartPriceField({
  productId,
  price,
  onCommit,
  className,
}: {
  productId: string;
  price: number;
  onCommit: (productId: string, price: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(() => String(price));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(String(price));
  }, [price]);

  const commit = () => {
    focusedRef.current = false;
    const parsed = parseLocaleNumber(draft);
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setDraft(String(next));
    onCommit(productId, next);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => {
        focusedRef.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => {
        e.stopPropagation();
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={commit}
      className={className}
    />
  );
}
