import { Building2, Loader2 } from 'lucide-react';

interface BusinessLoadingOverlayProps {
  businessName?: string;
  businessLogo?: string | null;
}

export function BusinessLoadingOverlay({ businessName, businessLogo }: BusinessLoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center">
      <div className="text-center space-y-6">
        {/* Logo animado */}
        <div className="relative">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl overflow-hidden">
            {businessLogo ? (
              <img 
                src={businessLogo} 
                alt={businessName || 'Negocio'} 
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="w-10 h-10 text-white" />
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-24 h-24 text-blue-500 animate-spin" style={{ strokeWidth: 1.5 }} />
          </div>
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">
            Cargando negocio...
          </h2>
          {businessName && (
            <p className="text-sm text-gray-600">
              {businessName}
            </p>
          )}
        </div>

        {/* Indicador de progreso */}
        <div className="w-64 h-1 bg-gray-200 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}