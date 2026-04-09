// VERSIÓN ULTRA MÍNIMA - SIN IMPORTS
// eslint-disable-next-line
// @ts-nocheck

let errorLog: string[] = [];

try {
  window.addEventListener('error', (event) => {
    errorLog.push(`ERROR: ${event.message}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorLog.push(`PROMISE: ${event.reason}`);
  });
} catch (e) {
  errorLog.push('No se puede capturar errores');
}

export default function AppMinimal() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#0f0', padding: '20px', fontFamily: 'monospace', fontSize: '14px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>🟢 SISTEMA ACTIVO</h1>
      
      <div style={{ background: '#111', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #0f0' }}>
        <div style={{ marginBottom: '8px' }}>✅ React montado correctamente</div>
        <div style={{ marginBottom: '8px' }}>✅ Component renderizado</div>
        <div style={{ marginBottom: '8px' }}>✅ JavaScript funcional</div>
        <div style={{ marginBottom: '8px' }}>📱 Ancho: {typeof window !== 'undefined' ? window.innerWidth : 'N/A'}px</div>
        <div style={{ marginBottom: '8px' }}>📅 Fecha: {new Date().toLocaleString()}</div>
      </div>

      {errorLog.length > 0 && (
        <div style={{ background: '#f00', color: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>🚨 ERRORES:</h2>
          {errorLog.map((err, i) => (
            <div key={i} style={{ marginBottom: '5px', fontSize: '12px' }}>{err}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => {
            try {
              localStorage.clear();
              alert('✅ LocalStorage limpiado');
              setTimeout(() => window.location.reload(), 500);
            } catch (e) {
              alert('❌ Error: ' + e.message);
            }
          }}
          style={{
            width: '100%',
            padding: '15px',
            background: '#f00',
            color: '#fff',
            border: '2px solid #fff',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🗑️ LIMPIAR TODO
        </button>

        <button
          onClick={() => {
            window.location.href = '/login';
          }}
          style={{
            width: '100%',
            padding: '15px',
            background: '#0f0',
            color: '#000',
            border: '2px solid #fff',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🔐 IR A LOGIN
        </button>
        
        <button
          onClick={() => {
            const info = [
              `Items en localStorage: ${Object.keys(localStorage).length}`,
              `UserAgent: ${navigator.userAgent.slice(0, 100)}`,
              `Idioma: ${navigator.language}`,
              `Online: ${navigator.onLine}`,
            ];
            alert(info.join('\n'));
          }}
          style={{
            width: '100%',
            padding: '15px',
            background: '#00f',
            color: '#fff',
            border: '2px solid #fff',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          ℹ️ INFO DEL SISTEMA
        </button>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#111', borderRadius: '8px', fontSize: '12px', maxHeight: '300px', overflow: 'auto', border: '1px solid #0f0' }}>
        <div style={{ color: '#ff0', marginBottom: '10px', fontWeight: 'bold' }}>📦 LocalStorage ({Object.keys(localStorage).length} items):</div>
        {Object.keys(localStorage).length === 0 ? (
          <div style={{ color: '#888' }}>Vacío</div>
        ) : (
          Object.keys(localStorage).map((key) => {
            const value = localStorage.getItem(key) || '';
            return (
              <div key={key} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
                <div style={{ color: '#0ff' }}>{key}</div>
                <div style={{ color: '#888', wordBreak: 'break-all' }}>{value.slice(0, 100)}{value.length > 100 ? '...' : ''}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
