export default function InvitePageDirect() {
  const token = window.location.hash.split('/invite/')[1];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">🎉 ¡Página de Invitación!</h1>
          <p className="text-lg text-gray-700 mb-6">¡Funciona perfectamente!</p>
          
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 font-mono break-all">
              Token: {token ? token.substring(0, 50) + '...' : 'No encontrado'}
            </p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="email" 
              placeholder="Tu correo" 
              className="w-full px-4 py-3 border rounded-lg"
              defaultValue="beahero_ec@hotmail.com"
            />
            <input 
              type="password" 
              placeholder="Tu contraseña" 
              className="w-full px-4 py-3 border rounded-lg"
            />
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg">
              Crear Cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
