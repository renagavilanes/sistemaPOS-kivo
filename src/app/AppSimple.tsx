// VERSION ULTRA SIMPLE - Captura errores globales
let errorLog: string[] = [];

// Capturar errores globales
window.addEventListener('error', (event) => {
  errorLog.push(`ERROR: ${event.message} at ${event.filename}:${event.lineno}`);
});

window.addEventListener('unhandledrejection', (event) => {
  errorLog.push(`PROMISE ERROR: ${event.reason}`);
});

export default function AppSimple() {
  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', color: 'white', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>🔍 DIAGNÓSTICO MÓVIL</h1>
      
      <div style={{ background: '#2a2a2a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>✅ React funciona</div>
        <div style={{ marginBottom: '10px' }}>✅ Component renderizado</div>
        <div style={{ marginBottom: '10px' }}>📱 User Agent: {navigator.userAgent.slice(0, 50)}...</div>
        <div style={{ marginBottom: '10px' }}>🌐 Window width: {window.innerWidth}px</div>
      </div>

      {errorLog.length > 0 && (
        <div style={{ background: '#ff0000', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>🚨 ERRORES DETECTADOS:</h2>
          {errorLog.map((err, i) => (
            <div key={i} style={{ marginBottom: '5px', fontSize: '12px' }}>{err}</div>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          localStorage.clear();
          alert('LocalStorage limpiado');
          window.location.reload();
        }}
        style={{
          width: '100%',
          padding: '15px',
          background: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          marginBottom: '10px',
          cursor: 'pointer'
        }}
      >
        🗑️ LIMPIAR TODO Y REINICIAR
      </button>

      <button
        onClick={() => {
          window.location.href = '/login';
        }}
        style={{
          width: '100%',
          padding: '15px',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        🔐 IR A LOGIN
      </button>

      <div style={{ marginTop: '20px', padding: '15px', background: '#2a2a2a', borderRadius: '8px', fontSize: '12px' }}>
        <div>localStorage items: {Object.keys(localStorage).length}</div>
        <div style={{ marginTop: '10px', maxHeight: '200px', overflow: 'auto' }}>
          {Object.keys(localStorage).map((key) => (
            <div key={key} style={{ marginBottom: '5px', wordBreak: 'break-all' }}>
              • {key}: {localStorage.getItem(key)?.slice(0, 30)}...
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}