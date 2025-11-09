import { X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { FileItem } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { PDFViewer } from './PDFViewer';

interface FileViewerProps {
  file: FileItem;
  onClose: () => void;
  accessToken: string;
}

export function FileViewer({ file, onClose, accessToken }: FileViewerProps) {
  // Gera URL para visualizar o arquivo
  const getViewerUrl = () => {
    if (file.webViewLink) {
      // Para arquivos do Google Drive, usa o link de visualização
      return file.webViewLink;
    }

    // Para outros arquivos, tenta usar o endpoint de visualização do Drive
    if (file.type === 'pdf') {
      return `https://drive.google.com/file/d/${file.id}/preview`;
    }

    if (file.type === 'png' || file.type === 'jpg') {
      return `https://drive.google.com/uc?export=view&id=${file.id}`;
    }

    // Para vídeos e outros, usa o viewer do Drive
    return `https://drive.google.com/file/d/${file.id}/preview`;
  };

  const getEmbedUrl = () => {
    // Gera URL para embed do Google Drive
    // O Google Drive permite visualizar muitos tipos de arquivo através do preview
    return `https://drive.google.com/file/d/${file.id}/preview`;
  };

  // Verifica se é um vídeo baseado no tipo, extensão ou metadados
  const isVideo = () => {
    // Primeiro verifica pelo tipo (mais confiável agora que está mapeado corretamente)
    if (file.type === 'video') {
      return true;
    }

    // Verifica pelos metadados de vídeo
    if (file.videoWidth || file.videoDuration) {
      return true;
    }

    // Verifica pela extensão
    if (file.extension) {
      const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv', '.mpeg', '.flv', '.mpg', '.m4v', '.3gp', '.ts'];
      if (videoExts.some(ext => file.extension?.toLowerCase().includes(ext.toLowerCase()))) {
        return true;
      }
    }
    
    // Verifica pelo nome do arquivo
    if (file.originalName || file.name) {
      const name = (file.originalName || file.name).toLowerCase();
      const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv', '.mpeg', '.flv', '.mpg', '.m4v', '.3gp', '.ts'];
      if (videoExts.some(ext => name.endsWith(ext))) {
        return true;
      }
    }
    
    return false;
  };

  const renderContent = () => {
    const viewerUrl = getViewerUrl();
    const embedUrl = getEmbedUrl();

    // Vídeos - usa player customizado
    if (isVideo()) {
      return <VideoPlayer file={file} accessToken={accessToken} />;
    }

    // PDFs - usa visualizador customizado
    // Verifica pelo tipo ou pela extensão/nome do arquivo
    const isPdf = file.type === 'pdf' || 
                  file.extension?.toLowerCase() === '.pdf' ||
                  (file.originalName || file.name || '').toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      console.log('[FileViewer] Detectado PDF:', file.name, 'tipo:', file.type, 'extensão:', file.extension);
      return <PDFViewer file={file} accessToken={accessToken} />;
    }

    // Imagens
    if (file.type === 'png' || file.type === 'jpg') {
      const imageUrl = `https://drive.google.com/uc?export=view&id=${file.id}`;
      return (
        <div className="flex items-center justify-center h-full bg-black p-2 sm:p-4">
          <img
            src={imageUrl}
            alt={file.name}
            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
            onError={(e) => {
              // Se falhar, tenta o webViewLink
              if (file.webViewLink) {
                window.open(file.webViewLink, '_blank');
              }
            }}
          />
        </div>
      );
    }

    // Outros arquivos - usa iframe do Google Drive
    return (
      <iframe
        src={embedUrl}
        className="w-full h-full max-w-full border-0"
        title={file.name}
        allow="fullscreen; autoplay; encrypted-media"
        allowFullScreen
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <h2 className="text-sm sm:text-lg font-semibold text-white truncate">
            {file.name}
          </h2>
          <span className="text-xs sm:text-sm text-gray-400 flex-shrink-0 hidden sm:inline">{file.size}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <a
            href={getViewerUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Abrir em nova aba"
          >
            <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </a>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#0f0f0f]">
        {renderContent()}
      </div>

      {/* Footer */}
      <div className="bg-[#1a1a1a] border-t border-gray-800 px-3 sm:px-6 py-2 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm text-gray-400">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <span className="hidden sm:inline">Proprietário: {file.owner}</span>
          <span className="hidden sm:inline">•</span>
          <span>Modificado: {file.modifiedDate}</span>
        </div>
        <button
          onClick={() => window.open(getViewerUrl(), '_blank')}
          className="text-blue-400 hover:text-blue-300 transition-colors text-xs sm:text-sm"
        >
          Abrir no Google Drive
        </button>
      </div>
    </div>
  );
}

