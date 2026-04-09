export default function InvitePageUltraSimple() {
  console.log('🚀 InvitePageUltraSimple CARGANDO');
  
  return (
    <div style={{
      padding: '50px',
      backgroundColor: '#ff0000',
      color: 'white',
      fontSize: '32px',
      fontWeight: 'bold',
      minHeight: '100vh',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>
        ✅ PÁGINA DE INVITACIÓN FUNCIONANDO
      </h1>
      <p style={{ fontSize: '24px' }}>
        Si ves este fondo ROJO, la ruta funciona correctamente
      </p>
      <p style={{ fontSize: '18px', marginTop: '40px' }}>
        Token: {window.location.hash}
      </p>
    </div>
  );
}
