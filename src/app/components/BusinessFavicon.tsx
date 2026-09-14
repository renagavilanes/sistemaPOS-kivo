import { useEffect } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { applyBusinessAppIcons, applyKivoAppIcons } from '../lib/appIcons';

function businessLogoSrc(business: { logo?: string; logo_url?: string } | null): string | null {
  if (!business) return null;
  const src = (business.logo || business.logo_url || '').trim();
  return src || null;
}

/** Favicon y apple-touch-icon: logo del negocio, o Kivo si no hay. */
export function BusinessFavicon() {
  const { currentBusiness } = useBusiness();
  const logo = businessLogoSrc(currentBusiness);

  useEffect(() => {
    let cancelled = false;
    if (!logo) {
      applyKivoAppIcons();
      return () => {
        cancelled = true;
      };
    }
    void applyBusinessAppIcons(logo, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [currentBusiness?.id, logo]);

  return null;
}
