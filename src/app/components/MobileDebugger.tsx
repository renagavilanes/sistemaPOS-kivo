import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

export function MobileDebugger() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Interceptar console.log, console.error
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        message,
        type: 'info'
      }].slice(-20)); // Mantener solo los últimos 20 logs
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        message,
        type: 'error'
      }].slice(-20));
      
      // Mostrar automáticamente cuando hay error
      setIsVisible(true);
    };

    // Cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  // Botón flotante para abrir/cerrar
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg font-bold"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        🐛
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-2xl sm:max-h-[80vh] h-[70vh] sm:rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-red-50">
          <div>
            <h3 className="font-bold text-lg">Debug Console</h3>
            <p className="text-xs text-gray-600">{logs.length} logs</p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 hover:bg-red-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay logs todavía...</p>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`p-2 rounded ${
                  log.type === 'error' 
                    ? 'bg-red-100 text-red-900' 
                    : log.type === 'success'
                    ? 'bg-green-100 text-green-900'
                    : 'bg-white text-gray-900'
                }`}
              >
                <div className="flex gap-2">
                  <span className="text-gray-500 flex-shrink-0">{log.timestamp}</span>
                  <span className="flex-1 break-all">{log.message}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-white flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
          >
            Limpiar logs
          </button>
        </div>
      </div>
    </div>
  );
}