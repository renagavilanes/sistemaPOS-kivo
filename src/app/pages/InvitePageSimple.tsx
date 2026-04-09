import { useState, useEffect } from 'react';
import { useParams } from 'react-router';

export default function InvitePageSimple() {
  const { token } = useParams();
  const [status, setStatus] = useState('Loading...');
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    console.log('🔍 Simple page - Token:', token);
    
    if (!token) {
      setStatus('No token provided');
      return;
    }
    
    try {
      const decoded = JSON.parse(atob(token));
      console.log('✅ Decoded:', decoded);
      setData(decoded);
      setStatus('Success');
    } catch (err) {
      console.error('❌ Error:', err);
      setStatus('Invalid token');
    }
  }, [token]);
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(to bottom right, #dbeafe, #e0e7ff)'
    }}>
      <div style={{
        maxWidth: '500px',
        margin: '50px auto',
        background: 'white',
        padding: '30px',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
          Invitación de Empleado
        </h1>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Status:</strong> {status}
        </div>
        
        {data && (
          <div style={{ 
            background: '#f3f4f6', 
            padding: '15px', 
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            <p><strong>Nombre:</strong> {data.name}</p>
            <p><strong>Email:</strong> {data.email}</p>
            <p><strong>Rol:</strong> {data.role}</p>
            <p><strong>Business ID:</strong> {data.businessId}</p>
          </div>
        )}
        
        {status === 'Success' && (
          <form style={{ marginTop: '30px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Crear Contraseña
              </label>
              <input 
                type="password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Confirmar Contraseña
              </label>
              <input 
                type="password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
                placeholder="Repite tu contraseña"
              />
            </div>
            
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Crear Cuenta
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
