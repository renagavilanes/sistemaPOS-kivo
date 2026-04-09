import { useParams } from 'react-router';

export default function InviteTestPage() {
  const { token } = useParams();
  
  console.log('🧪 TEST PAGE - Token:', token);
  
  let decoded = null;
  try {
    if (token) {
      decoded = JSON.parse(atob(token));
      console.log('🧪 TEST PAGE - Decoded:', decoded);
    }
  } catch (err) {
    console.error('🧪 TEST PAGE - Error:', err);
  }
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 Invite Test Page</h1>
      <p><strong>Token:</strong> {token || 'NO TOKEN'}</p>
      <p><strong>Token Length:</strong> {token?.length || 0}</p>
      {decoded && (
        <div>
          <h2>Decoded Data:</h2>
          <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
            {JSON.stringify(decoded, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
