// Versión simple de SalesPage para diagnóstico
import { MobileBusinessHeader } from '../components/MobileBusinessHeader';
import { useBusiness } from '../contexts/BusinessContext';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { ShoppingCart, Package } from 'lucide-react';
import { useLocation } from 'react-router';

export default function SalesPageSimple() {
  const { currentBusiness } = useBusiness();
  const location = useLocation();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#1a1a1a', 
      color: '#fff',
    }}>
      <MobileBusinessHeader />
      
      <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
          🛒 Ventas (Prueba Simple)
        </h1>

        {/* Debug info */}
        <div style={{ 
          background: '#2a2a2a', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '20px',
          border: '2px solid #fbbf24'
        }}>
          <p style={{ fontSize: '14px', color: '#fbbf24', marginBottom: '5px' }}>
            🔍 DEBUG: Ruta actual = <strong>{location.pathname}</strong>
          </p>
        </div>
        
        {/* Tabs para cambiar entre Venta y Gasto */}
        <Tabs defaultValue="sale" className="mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sale">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Venta
            </TabsTrigger>
            <TabsTrigger value="expense">
              <Package className="h-4 w-4 mr-2" />
              Gasto
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#888', marginBottom: '10px' }}>
            Negocio actual: <strong style={{ color: '#4ade80' }}>{currentBusiness?.name || 'Ninguno'}</strong>
          </p>
        </div>
        
        {/* Zona de productos (placeholder) */}
        <div style={{ 
          background: '#2a2a2a', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Catálogo de Productos</h2>
          <div style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aquí irá el catálogo de productos</p>
          </div>
        </div>
        
        {/* Carrito (placeholder) */}
        <div style={{ 
          background: '#2a2a2a', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Carrito de Compras</h2>
          <div style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>El carrito está vacío</p>
          </div>
        </div>
        
        {/* Botón de pagar */}
        <Button className="w-full" size="lg" disabled>
          Procesar Pago
        </Button>
        
        <div style={{ marginTop: '30px', fontSize: '14px', color: '#888', textAlign: 'center' }}>
          ✅ Si ves esto, la página de Ventas carga correctamente
        </div>
      </div>
    </div>
  );
}