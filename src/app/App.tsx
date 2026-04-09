import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { BusinessProvider } from './contexts/BusinessContext';

export default function App() {
  console.log('🚀 [APP] App component loading...');
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BusinessProvider>
          <RouterProvider router={router} />
          <Toaster />
        </BusinessProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}