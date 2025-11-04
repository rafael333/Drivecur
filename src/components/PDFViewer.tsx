import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Minimize, Loader2, Download, RotateCw } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileItem } from '../types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configura o worker do PDF.js
// Detecta se é mobile e usa worker apropriado
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  // No mobile, usa unpkg que geralmente funciona melhor
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
} else {
  // No desktop, usa jsDelivr
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

console.log('[PDFViewer] Worker configurado:', pdfjs.GlobalWorkerOptions.workerSrc, '(mobile:', isMobile + ')');

interface PDFViewerProps {
  file: FileItem;
  accessToken: string;
}

export function PDFViewer({ file, accessToken }: PDFViewerProps) {
  // Detecta se é mobile
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Scale inicial menor no mobile para não esticar
  const [scale, setScale] = useState(isMobileDevice ? 1.0 : 1.5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Gera URL do PDF do Google Drive
  useEffect(() => {
    const loadPdf = async () => {
      try {
        console.log('[PDFViewer] Iniciando carregamento do PDF:', file.name, file.id);
        setIsLoading(true);
        setError(null);

        // URL para baixar o PDF do Google Drive
        // Adiciona supportsAllDrives para arquivos compartilhados
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
        
        console.log('[PDFViewer] Fazendo requisição para:', downloadUrl);
        
        // Faz o download do PDF
        const response = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log('[PDFViewer] Resposta recebida, status:', response.status);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Erro desconhecido');
          console.error('[PDFViewer] Erro na resposta:', errorText);
          throw new Error(`Erro ao carregar PDF: ${response.status} - ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('[PDFViewer] Blob criado, tamanho:', blob.size, 'tipo:', blob.type);
        
        const url = URL.createObjectURL(blob);
        console.log('[PDFViewer] URL do blob criada:', url);
        setPdfUrl(url);
      } catch (err: any) {
        console.error('[PDFViewer] Erro ao carregar PDF:', err);
        setError(err.message || 'Erro ao carregar PDF');
        setIsLoading(false);
      }
    };

    if (file.id && accessToken) {
      loadPdf();
    } else {
      console.warn('[PDFViewer] Faltando file.id ou accessToken:', { fileId: file.id, hasToken: !!accessToken });
    }

    // Cleanup: revoga a URL do blob quando o componente for desmontado
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [file.id, accessToken]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('[PDFViewer] Documento carregado com sucesso! Total de páginas:', numPages);
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('[PDFViewer] Erro ao carregar documento PDF:', error);
    
    // Se o erro for relacionado ao worker, mostra mensagem mais útil
    if (error.message.includes('worker') || error.message.includes('Failed to fetch')) {
      console.log('[PDFViewer] Erro de worker detectado. Tentando usar worker alternativo...');
      
      // Tenta alternar para um worker diferente
      const currentWorker = pdfjs.GlobalWorkerOptions.workerSrc;
      
      if (currentWorker?.includes('jsdelivr')) {
        // Se estava usando jsdelivr, tenta unpkg
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        console.log('[PDFViewer] Alternando para unpkg:', pdfjs.GlobalWorkerOptions.workerSrc);
      } else if (currentWorker?.includes('unpkg')) {
        // Se estava usando unpkg, tenta a versão .js ao invés de .mjs
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
        console.log('[PDFViewer] Alternando para worker .js:', pdfjs.GlobalWorkerOptions.workerSrc);
      }
      
      // Não define erro imediatamente, deixa tentar carregar novamente
      // O erro será mostrado se todas as tentativas falharem
    }
    
    setError(`Erro ao carregar documento PDF: ${error.message}. Verifique sua conexão com a internet.`);
    setIsLoading(false);
  };

  // Detecta a página atual baseada no scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !numPages) return;

    const handleScroll = () => {
      const containerTop = scrollContainer.scrollTop;
      const containerHeight = scrollContainer.clientHeight;
      const viewportCenter = containerTop + containerHeight / 2;

      // Encontra a página que está mais próxima do centro da viewport
      let closestPage = 1;
      let minDistance = Infinity;

      pageRefs.current.forEach((pageElement, pageNum) => {
        if (!pageElement) return;
        
        const pageTop = pageElement.offsetTop;
        const pageHeight = pageElement.offsetHeight;
        const pageCenter = pageTop + pageHeight / 2;
        const distance = Math.abs(viewportCenter - pageCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestPage = pageNum;
        }
      });

      setCurrentPage(closestPage);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [numPages]);

  const goToPage = (page: number) => {
    const pageElement = pageRefs.current.get(page);
    if (pageElement && scrollContainerRef.current) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(page);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (numPages && currentPage < numPages) {
      goToPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(3, prev + 0.25));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.25));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${file.originalName || file.name || 'documento'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white p-8">
        <div className="text-center">
          <p className="text-red-400 mb-4">❌ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-black text-white relative">
      {/* Controles - escondidos em fullscreen */}
      {!isFullscreen && (
        <div className="bg-[#1a1a1a] border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 px-3">
            <span className="text-sm">
              Página{' '}
              <input
                type="number"
                min={1}
                max={numPages || 1}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value, 10);
                  if (page >= 1 && page <= (numPages || 1)) {
                    goToPage(page);
                  }
                }}
                className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-center text-sm"
              />
              {' '}de {numPages || '...'}
            </span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= (numPages || 1)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Próxima página"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Diminuir zoom"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <span className="text-sm px-2 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <button
            onClick={handleRotate}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Rotacionar"
          >
            <RotateCw className="w-5 h-5" />
          </button>

          <button
            onClick={handleDownload}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Baixar PDF"
          >
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={handleFullscreen}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
      )}

      {/* Botão para sair do fullscreen - aparece apenas quando em fullscreen */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={handleFullscreen}
            className="p-3 bg-black/70 hover:bg-black/90 rounded-lg transition-colors backdrop-blur-sm"
            title="Sair da tela cheia"
          >
            <Minimize className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Área do PDF com scroll vertical */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden bg-gray-900 ${
          isFullscreen ? 'p-0' : 'p-2 sm:p-4'
        }`}
        style={{ scrollBehavior: 'smooth' }}
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 min-h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-gray-400">Carregando PDF...</p>
          </div>
        )}

        {pdfUrl && !error && (
          <div className={`flex flex-col items-center w-full max-w-full ${
            isFullscreen ? 'gap-0 pb-0' : 'gap-2 sm:gap-4 pb-8'
          }`}>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center gap-4 min-h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-gray-400">Carregando documento...</p>
                </div>
              }
              error={
                <div className="text-center text-red-400 p-8">
                  <p>Erro ao carregar o documento PDF</p>
                  <p className="text-sm text-gray-500 mt-2">Verifique o console para mais detalhes</p>
                </div>
              }
            >
              {/* Renderiza todas as páginas em sequência */}
              {numPages && Array.from(new Array(numPages), (el, index) => (
                <div
                  key={`page_${index + 1}`}
                  ref={(el) => {
                    if (el) {
                      pageRefs.current.set(index + 1, el);
                    } else {
                      pageRefs.current.delete(index + 1);
                    }
                  }}
                  className={`flex justify-center w-full ${
                    isFullscreen ? 'mb-0' : 'mb-2 sm:mb-4'
                  }`}
                  style={{ maxWidth: '100%', overflow: 'hidden' }}
                >
                  <Page
                    pageNumber={index + 1}
                    scale={scale}
                    rotate={rotation}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-2xl"
                    width={isMobileDevice ? Math.min(window.innerWidth - 32, 800) : undefined}
                    loading={
                      <div className="flex items-center justify-center p-8 bg-gray-800 rounded">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                      </div>
                    }
                  />
                </div>
              ))}
            </Document>
          </div>
        )}
        
        {!pdfUrl && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center gap-4 min-h-full">
            <p className="text-gray-400">Aguardando carregamento do PDF...</p>
          </div>
        )}
      </div>
    </div>
  );
}

