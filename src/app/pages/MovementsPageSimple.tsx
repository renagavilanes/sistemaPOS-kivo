// Versión simple de MovementsPage para diagnóstico
import { useBusiness } from '../contexts/BusinessContext';
import { useLocation } from 'react-router';

export default function MovementsPageSimple() {
  const { currentBusiness } = useBusiness();
  const location = useLocation();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      color: '#fff',
      padding: '20px'
    }}>
      <div style={{ 
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '15px',
        padding: '30px',
        marginTop: '20px'
      }}>
        <h1 style={{ 
          fontSize: '32px', 
          marginBottom: '20px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          📊 MOVIMIENTOS
        </h1>
        
        <div style={{ 
          background: 'rgba(255,255,255,0.2)', 
          padding: '20px', 
          borderRadius: '10px',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>
            ✅ Ruta actual: <strong>{location.pathname}</strong>
          </p>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>
            ✅ Negocio: <strong>{currentBusiness?.name || 'Ninguno'}</strong>
          </p>
          <p style={{ fontSize: '18px' }}>
            ✅ Esta es la página de MOVIMIENTOS (NO VENTAS)
          </p>
        </div>

        <div style={{ 
          background: 'rgba(255,255,255,0.2)', 
          padding: '40px', 
          borderRadius: '10px',
          textAlign: 'center',
          fontSize: '48px',
          marginBottom: '20px'
        }}>
          📈 📉 💰
        </div>

        <div style={{ 
          background: 'rgba(255,255,255,0.2)', 
          padding: '20px', 
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>
            ESTA PÁGINA ES MORADA
          </p>
          <p style={{ fontSize: '16px' }}>
            Si ves esta página morada, MovementsPage funciona ✅
          </p>
        </div>
      </div>
    </div>
  );
}
