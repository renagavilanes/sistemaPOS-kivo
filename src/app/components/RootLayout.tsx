import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { ScreenFxProvider } from '../contexts/ScreenFxContext';

export default function RootLayout() {
  return (
    <ScreenFxProvider>
      <Sidebar />
      <div className="lg:pl-[240px]">
        <Outlet />
      </div>
    </ScreenFxProvider>
  );
}