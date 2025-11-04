import { X, Download, CheckCircle2 } from 'lucide-react';

export interface DownloadItem {
  id: string;
  fileName: string;
  progress: number; // 0-100
  status: 'downloading' | 'completed' | 'error';
  error?: string;
}

interface DownloadProgressProps {
  downloads: DownloadItem[];
  onClose: (id: string) => void;
}

export function DownloadProgress({ downloads, onClose }: DownloadProgressProps) {
  if (downloads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full sm:w-auto">
      {downloads.map((download) => (
        <div
          key={download.id}
          className="bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-xl p-4 slide-in"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {download.status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : download.status === 'error' ? (
                <X className="w-5 h-5 text-red-500" />
              ) : (
                <Download className="w-5 h-5 text-blue-500 animate-pulse" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white truncate">
                  {download.fileName}
                </p>
                <button
                  onClick={() => onClose(download.id)}
                  className="flex-shrink-0 p-1 hover:bg-gray-800 rounded transition-colors ml-2"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {download.status === 'downloading' && (
                <>
                  <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${download.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">{download.progress.toFixed(0)}%</p>
                </>
              )}

              {download.status === 'completed' && (
                <p className="text-xs text-green-400">Download concluído!</p>
              )}

              {download.status === 'error' && (
                <p className="text-xs text-red-400">{download.error || 'Erro ao baixar'}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

