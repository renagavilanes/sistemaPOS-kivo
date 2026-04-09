import { useLocation } from 'react-router';
import { useBusiness } from '../contexts/BusinessContext';

export default function MorePageSimple() {
  const location = useLocation();
  const { currentBusiness } = useBusiness();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          ⚙️ MÁS
        </h1>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-6">
          <div className="space-y-4 text-white text-lg">
            <div>✅ Ruta actual: {location.pathname}</div>
            <div>✅ Negocio: {currentBusiness?.name || 'Sin negocio'}</div>
            <div>✅ Esta es la página MÁS (NO VENTAS)</div>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 text-center">
          <div className="text-6xl mb-6">⚙️🔧🛠️</div>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 mt-6">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            ESTA PÁGINA ES NARANJA
          </h2>
          <p className="text-white text-center text-lg">
            Si ves esta página naranja, MorePage funciona ✅
          </p>
        </div>
      </div>
    </div>
  );
}
