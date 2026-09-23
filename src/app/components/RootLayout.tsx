import { useEffect } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { ScreenFxProvider } from '../contexts/ScreenFxContext';
import { useBusiness } from '../contexts/BusinessContext';
import { canAccessPath, getHomePath } from '../lib/businessAccess';

export default function RootLayout() {
  const { currentBusiness } = useBusiness();
  const outlet = useOutlet();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentBusiness) return;
    const path = location.pathname;
    if (!canAccessPath(path, currentBusiness)) {
      navigate(getHomePath(currentBusiness), { replace: true });
    }
  }, [currentBusiness, location.pathname, navigate]);

  return (
    <ScreenFxProvider>
      <Sidebar />
      <div className="lg:pl-16 xl:pl-[240px]" key={currentBusiness?.id ?? 'no-business'}>
        {outlet}
      </div>
    </ScreenFxProvider>
  );
}