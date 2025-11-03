import { X, Download, Share2, Trash2, User, Calendar, HardDrive, Eye, Clock, Star, Users, FileText, Video, Image as ImageIcon } from 'lucide-react';
import { FileItem } from '../types';
import { FileIcon } from './FileIcon';
import { downloadFile } from '../lib/googleDrive';

interface FileDetailsProps {
  file: FileItem;
  onClose: () => void;
  onView?: () => void;
  accessToken?: string;
  onDownloadStart?: (fileName: string) => string;
  onDownloadProgress?: (id: string, progress: number) => void;
  onDownloadComplete?: (id: string) => void;
  onDownloadError?: (id: string, error: string) => void;
}

export function FileDetails({ file, onClose, onView, accessToken, onDownloadStart, onDownloadProgress, onDownloadComplete, onDownloadError }: FileDetailsProps) {
  const handleDownload = async () => {
    if (!accessToken) return;
    
    const fileName = file.originalName || file.name || 'download';
    const downloadId = onDownloadStart ? onDownloadStart(fileName) : null;
    
    try {
      await downloadFile(
        file,
        accessToken,
        downloadId && onDownloadProgress
          ? (progress) => onDownloadProgress(downloadId, progress)
          : undefined
      );
      
      if (downloadId && onDownloadComplete) {
        onDownloadComplete(downloadId);
      }
    } catch (error: any) {
      if (downloadId && onDownloadError) {
        onDownloadError(downloadId, error.message || 'Erro ao baixar o arquivo');
      } else {
        alert(error.message || 'Erro ao baixar o arquivo');
      }
    }
  };
  return (
    <div className="
      fixed lg:relative inset-y-0 right-0 z-50
      w-full lg:w-96 bg-[#1a1a1a] border-l border-gray-800 
      flex flex-col overflow-auto transform transition-transform duration-300
      lg:translate-x-0
    ">
      <div className="p-4 sm:p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-[#1a1a1a] z-10">
        <h2 className="text-base sm:text-lg font-semibold">Detalhes do arquivo</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Fechar detalhes"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">
            <FileIcon type={file.type} />
          </div>
          <div className="flex items-center gap-2 mb-1 flex-wrap justify-center">
            <h3 className="text-base sm:text-xl font-semibold break-words text-center">{file.originalName || file.name}</h3>
            {file.extension && (
              <span className="text-gray-400 text-xs sm:text-sm font-mono flex-shrink-0">
                {file.extension}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">{file.size}</p>
        </div>

        <div className="space-y-3">
          {onView && (
            <button
              onClick={onView}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Eye className="w-5 h-5" />
              Visualizar
            </button>
          )}
          <button 
            onClick={handleDownload}
            disabled={!file.canDownload}
            className="w-full bg-[#202020] hover:bg-[#252525] text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors border border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title={file.canDownload ? 'Baixar arquivo' : 'Você não tem permissão para baixar este arquivo'}
          >
            <Download className="w-5 h-5" />
            Baixar
          </button>
          <button 
            disabled={!file.canShare}
            className="w-full bg-[#202020] hover:bg-[#252525] text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors border border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title={file.canShare ? 'Compartilhar arquivo' : 'Você não tem permissão para compartilhar este arquivo'}
          >
            <Share2 className="w-5 h-5" />
            Compartilhar
          </button>
          <button 
            disabled={!file.canDelete}
            className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors border border-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title={file.canDelete ? 'Excluir arquivo' : 'Você não tem permissão para excluir este arquivo'}
          >
            <Trash2 className="w-5 h-5" />
            Excluir
          </button>
        </div>

        <div className="pt-6 border-t border-gray-800 space-y-4">
          <h4 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">Informações</h4>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Proprietário</p>
                <p className="text-sm font-medium">{file.owner}</p>
                {file.ownerEmail && (
                  <p className="text-xs text-gray-500 mt-0.5">{file.ownerEmail}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Criado</p>
                <p className="text-sm font-medium">{file.createdDate}</p>
                {file.createdTime && (
                  <p className="text-xs text-gray-500 mt-0.5">{file.createdTime}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Modificado</p>
                <p className="text-sm font-medium">{file.modifiedDate}</p>
                {file.modifiedTime && (
                  <p className="text-xs text-gray-500 mt-0.5">{file.modifiedTime}</p>
                )}
                {file.lastModifiedBy && file.lastModifiedBy !== file.owner && (
                  <p className="text-xs text-gray-500 mt-0.5">por {file.lastModifiedBy}</p>
                )}
              </div>
            </div>

            {file.viewedByMeTime && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <Eye className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Última visualização</p>
                  <p className="text-sm font-medium">{file.viewedByMeTime}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                <HardDrive className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Tamanho</p>
                <p className="text-sm font-medium">{file.size}</p>
                {file.sizeBytes && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {file.sizeBytes.toLocaleString('pt-BR')} bytes
                  </p>
                )}
              </div>
            </div>

            {(file.imageWidth || file.videoWidth) && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-800 rounded-lg">
                  {file.videoWidth ? (
                    <Video className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Dimensões</p>
                  <p className="text-sm font-medium">
                    {file.imageWidth || file.videoWidth} × {file.imageHeight || file.videoHeight} px
                  </p>
                  {file.videoDuration && (
                    <p className="text-xs text-gray-500 mt-0.5">Duração: {file.videoDuration}</p>
                  )}
                </div>
              </div>
            )}

            {file.description && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Descrição</p>
                  <p className="text-sm font-medium">{file.description}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                <Users className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Compartilhamento</p>
                <div className="flex items-center gap-2 mt-1">
                  {file.shared && (
                    <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">Compartilhado</span>
                  )}
                  {file.starred && (
                    <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Favorito
                    </span>
                  )}
                </div>
                {file.permissionCount !== undefined && file.permissionCount > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {file.permissionCount} {file.permissionCount === 1 ? 'pessoa tem acesso' : 'pessoas têm acesso'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-800">
          <h4 className="font-semibold text-sm text-gray-400 uppercase tracking-wider mb-3">Atividade</h4>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                {file.ownerPhoto ? (
                  <img src={file.ownerPhoto} alt={file.owner} className="w-8 h-8 rounded-full" />
                ) : (
                  <User className="w-4 h-4 text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm"><span className="font-medium">{file.owner}</span> criou este arquivo</p>
                <p className="text-xs text-gray-500 mt-1">{file.createdDate}</p>
              </div>
            </div>
            {file.lastModifiedBy && file.lastModifiedBy !== file.owner && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                  {file.lastModifiedByPhoto ? (
                    <img src={file.lastModifiedByPhoto} alt={file.lastModifiedBy} className="w-8 h-8 rounded-full" />
                  ) : (
                    <User className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm"><span className="font-medium">{file.lastModifiedBy}</span> modificou este arquivo</p>
                  <p className="text-xs text-gray-500 mt-1">{file.modifiedDate}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
