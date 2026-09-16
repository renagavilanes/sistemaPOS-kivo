import { useOutlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { ScreenFxProvider } from '../contexts/ScreenFxContext';
import { useBusiness } from '../contexts/BusinessContext';

export default function RootLayout() {
  const { currentBusiness } = useBusiness();
  const outlet = useOutlet();

  return (
    <ScreenFxProvider>
      <Sidebar />
      <div className="lg:pl-16 xl:pl-[240px]" key={currentBusiness?.id ?? 'no-business'}>
        {outlet}
      </div>
    </ScreenFxProvider>
  );
}