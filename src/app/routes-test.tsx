import { createBrowserRouter } from 'react-router';
import CompleteTest from './pages/CompleteTest';

// Página de prueba simple
function TestPage({ name }: { name: string }) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#111', 
      color: '#0f0', 
      padding: '20px',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ fontSize: '28px', marginBottom: '20px' }}>
        ✅ Página: {name}
      </h1>
      <div style={{ fontSize: '16px', marginBottom: '10px' }}>
        Router funcionando correctamente
      </div>
      <div style={{ fontSize: '16px', marginBottom: '20px' }}>
        Ancho: {window.innerWidth}px
      </div>
      <a 
        href="/"
        style={{ 
          display: 'inline-block',
          padding: '15px 30px',
          background: '#00ff00',
          color: '#000',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: 'bold'
        }}
      >
        ← Volver
      </a>
    </div>
  );
}

// Layout simple
function SimpleLayout() {
  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <div style={{ 
        background: '#111', 
        color: '#0f0', 
        padding: '20px',
        fontFamily: 'monospace'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
          🧪 Router de Prueba - Funcionando ✅
        </h1>
        <p style={{ marginBottom: '20px', fontSize: '16px' }}>
          Ahora probemos cargar componentes reales uno por uno:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href="/complete-test" style={{ color: '#0f0', fontSize: '16px', fontWeight: 'bold' }}>→ ✅ PRUEBAS COMPLETAS DEL SISTEMA</a>
          <a href="/test-root" style={{ color: '#0f0', fontSize: '16px' }}>→ Test RootLayout</a>
          <a href="/test-protected" style={{ color: '#0f0', fontSize: '16px' }}>→ Test ProtectedLayout</a>
          <a href="/test-login" style={{ color: '#0f0', fontSize: '16px' }}>→ Test LoginPage</a>
          <a href="/test-sales" style={{ color: '#0f0', fontSize: '16px' }}>→ Test SalesPage</a>
          <a href="/test-movements" style={{ color: '#0f0', fontSize: '16px' }}>→ Test MovementsPage</a>
        </div>
      </div>
    </div>
  );
}

export const testRouter = createBrowserRouter([
  {
    path: '/',
    element: <SimpleLayout />,
  },
  {
    path: '/complete-test',
    element: <CompleteTest />,
  },
  {
    path: '/test-root',
    element: <TestPage name="RootLayout Test" />,
  },
  {
    path: '/test-protected',
    element: <TestPage name="ProtectedLayout Test" />,
  },
  {
    path: '/test-login',
    element: <TestPage name="LoginPage Test" />,
  },
  {
    path: '/test-sales',
    element: <TestPage name="SalesPage Test" />,
  },
  {
    path: '/test-movements',
    element: <TestPage name="MovementsPage Test" />,
  },
]);