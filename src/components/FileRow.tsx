import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Star, Users, MessageSquare, Palette, X, Pin, Download, FolderDown } from 'lucide-react';
import { FileItem } from '../types';
import { FileIcon } from './FileIcon';
import { FOLDER_COLOR_OPTIONS, getFolderColor, setFolderColor, removeFolderColor, isFolderPinnedSync, togglePinFolder, isFolderFavoriteSync, toggleFavoriteFolder, FILE_COLOR_OPTIONS, getFileTextColor, setFileTextColor, removeFileTextColor, isFileFavorite, toggleFavoriteFile } from '../lib/savedFolders';
import { downloadFile, downloadFolder } from '../lib/googleDrive';

interface FileRowProps {
  file: FileItem;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  isEven: boolean;
  hasAnnotations?: boolean; // Indica se o vídeo tem anotações OU se a pasta contém vídeos com anotações
  onColorChange?: () => void; // Callback para atualizar quando a cor mudar
  accessToken?: string; // Token de acesso para download
  onDownloadStart?: (fileName: string) => string;
  onDownloadProgress?: (id: string, progress: number) => void;
  onDownloadComplete?: (id: string) => void;
  onDownloadError?: (id: string, error: string) => void;
}

export function FileRow({ file, isSelected, onClick, onDoubleClick, isEven, hasAnnotations, onColorChange, accessToken, onDownloadStart, onDownloadProgress, onDownloadComplete, onDownloadError }: FileRowProps) {
  const [showActions, setShowActions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isFolder = file.type === 'folder';

  useEffect(() => {
    if (!showColorPicker && !showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker, showMenu]);

  const handleColorChange = (color: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.id) {
      if (isFolder) {
        setFolderColor(file.id, color);
        window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color } }));
      } else {
        setFileTextColor(file.id, color);
        window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color } }));
      }
      setShowColorPicker(false);
      setShowMenu(false);
      if (onColorChange) {
        onColorChange();
      }
    }
  };

  const handleRemoveColor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.id) {
      if (isFolder) {
        removeFolderColor(file.id);
        window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color: null } }));
      } else {
        removeFileTextColor(file.id);
        window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color: null } }));
      }
      setShowMenu(false);
      if (onColorChange) {
        onColorChange();
      }
    }
  };

  const handlePinToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder && file.id) {
      const folderName = file.name || file.originalName || '';
      const wasPinned = await togglePinFolder(file.id, folderName);
      setShowMenu(false);

      // Dispara evento após a operação ser concluída
      window.dispatchEvent(new CustomEvent('pinnedFolderChanged', { detail: { folderId: file.id, pinned: wasPinned } }));

      if (onColorChange) {
        onColorChange();
      }
    }
  };

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.id) {
      if (isFolder) {
        const folderName = file.name || file.originalName || '';
        const wasFavorited = await toggleFavoriteFolder(file.id, folderName);
        // Dispara evento após a operação ser concluída
        window.dispatchEvent(new CustomEvent('favoriteFolderChanged', { detail: { folderId: file.id, favorited: wasFavorited } }));
      } else {
        toggleFavoriteFile(file.id);
        window.dispatchEvent(new CustomEvent('favoriteFileChanged', { detail: { fileId: file.id } }));
      }
      setShowMenu(false);
      if (onColorChange) {
        onColorChange();
      }
    }
  };

  const handleDownloadFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isFolder) {
      console.warn('[handleDownloadFolder] Não é uma pasta');
      return;
    }

    if (!accessToken) {
      console.warn('[handleDownloadFolder] Sem accessToken');
      alert('Token de acesso necessário. Faça login novamente.');
      return;
    }

    if (!file.id) {
      console.warn('[handleDownloadFolder] Sem ID da pasta');
      alert('ID da pasta não encontrado.');
      return;
    }

    setShowMenu(false);

    const folderName = file.name || file.originalName || 'Pasta';
    console.log('[handleDownloadFolder] Iniciando download:', folderName, file.id);

    const folderDownloadId = onDownloadStart ? onDownloadStart(`${folderName} (pasta)`) : null;

    try {
      await downloadFolder(
        file.id,
        folderName,
        accessToken,
        folderDownloadId && onDownloadProgress
          ? (progress) => onDownloadProgress(folderDownloadId, progress)
          : undefined,
        onDownloadStart,
        onDownloadProgress,
        onDownloadComplete,
        onDownloadError
      );

      if (folderDownloadId && onDownloadComplete) {
        onDownloadComplete(folderDownloadId);
      }

      console.log('[handleDownloadFolder] Download concluído');
    } catch (error: any) {
      console.error('[handleDownloadFolder] Erro ao baixar pasta:', error);
      if (folderDownloadId && onDownloadError) {
        onDownloadError(folderDownloadId, error.message || 'Erro ao baixar pasta');
      } else {
        alert(error.message || 'Erro ao baixar pasta. Verifique o console para mais detalhes.');
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFolder && accessToken && file.canDownload) {
      setShowMenu(false);

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
    }
  };

  const folderColor = isFolder && file.id ? getFolderColor(file.id) : null;
  const fileTextColor = !isFolder && file.id ? getFileTextColor(file.id) : null;
  const isPinned = isFolder && file.id ? isFolderPinnedSync(file.id) : false;
  const isFavorite = file.id ? (isFolder ? isFolderFavoriteSync(file.id) : isFileFavorite(file.id)) : false;

  return (
    <tr
      className={`border-b border-app-glassBorder cursor-pointer transition-all duration-300 group ${isSelected
        ? 'bg-app-primary/10 relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-app-primary focus:outline-none'
        : 'hover:bg-app-glassHover/50 bg-transparent active:scale-[0.99] active:bg-app-glassHover'
        }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <td className="py-4 px-6">
        <div className="flex items-center gap-4">
          <FileIcon type={file.type} folderId={isFolder ? file.id : undefined} />
          <div className="flex items-center gap-2 flex-1">
            <span className="font-semibold" style={{ color: fileTextColor || 'white' }}>
              {(file.originalName || file.name || '').replace(/\.(mp4|pdf|zip|docx|xlsx|pptx|png|jpg)$/i, '')}
            </span>
            {file.starred && (
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" title="Favorito" />
            )}
            {isPinned && (
              <Pin className="w-4 h-4 text-blue-400 fill-blue-400" title="Fixada" />
            )}
            {isFavorite && (
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" title="Favoritada" />
            )}
            {file.shared && (
              <Users className="w-4 h-4 text-blue-400" title="Compartilhado" />
            )}
            {hasAnnotations && (
              <MessageSquare
                className="w-4 h-4 text-yellow-500 fill-yellow-500/20"
                title={file.type === 'folder' ? 'Contém vídeos com anotações' : 'Tem anotações'}
              />
            )}
          </div>
        </div>
      </td>
      <td className="py-4 px-6 text-gray-400 text-sm">{file.owner}</td>
      <td className="py-4 px-6 text-gray-400 text-sm">{file.modifiedDate}</td>
      <td className="py-4 px-6 text-gray-400 text-sm">{file.size}</td>
      <td className="py-4 px-6">
        <div className="relative" ref={menuRef}>
          <button
            className={`p-2 rounded-xl transition-all ${showActions || showMenu || showColorPicker
              ? 'opacity-100 bg-app-glassHover'
              : 'opacity-0 group-hover:opacity-100'
              }`}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
              setShowColorPicker(false);
            }}
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>

          {/* Menu de contexto para pastas e arquivos */}
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-2 glass-panel border border-app-glassBorder shadow-glass z-50 min-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2">
                {isFolder ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setShowColorPicker(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3"
                    >
                      <Palette className="w-4 h-4" style={folderColor ? { color: folderColor } : undefined} />
                      <span>Mudar cor</span>
                    </button>
                    {folderColor && (
                      <button
                        onClick={handleRemoveColor}
                        className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3"
                      >
                        <X className="w-4 h-4" />
                        <span>Remover cor</span>
                      </button>
                    )}
                    <button
                      onClick={handlePinToggle}
                      className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3"
                    >
                      <Pin className={`w-4 h-4 ${isPinned ? 'text-blue-400 fill-blue-400' : ''}`} />
                      <span>{isPinned ? 'Desfixar' : 'Fixar'}</span>
                    </button>
                    <button
                      onClick={handleFavoriteToggle}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
                      <span>{isFavorite ? 'Remover dos favoritos' : 'Favoritar'}</span>
                    </button>
                    <button
                      onClick={handleDownloadFolder}
                      className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3 mt-1 pt-3 border-t border-app-glassBorder"
                      title="Baixar pasta inteira"
                    >
                      <FolderDown className="w-4 h-4 text-app-primary" />
                      <span>Baixar pasta</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setShowColorPicker(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3"
                    >
                      <Palette className="w-4 h-4" style={fileTextColor ? { color: fileTextColor } : undefined} />
                      <span>Mudar cor do texto</span>
                    </button>
                    {fileTextColor && (
                      <button
                        onClick={handleRemoveColor}
                        className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3"
                      >
                        <X className="w-4 h-4" />
                        <span>Remover cor</span>
                      </button>
                    )}
                    <button
                      onClick={handleFavoriteToggle}
                      className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3"
                    >
                      <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
                      <span>{isFavorite ? 'Remover dos favoritos' : 'Favoritar'}</span>
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={!file.canDownload || !accessToken}
                      className="w-full px-4 py-2.5 text-left text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover rounded-xl transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mt-1 pt-3 border-t border-app-glassBorder"
                      title={file.canDownload ? 'Baixar arquivo' : 'Você não tem permissão para baixar este arquivo'}
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Seletor de cores */}
          {showColorPicker && (
            <div
              className="absolute right-0 top-full mt-2 glass-panel border border-app-glassBorder shadow-glass p-3 z-50 min-w-[220px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">{isFolder ? 'Escolha uma cor' : 'Escolha uma cor para o texto'}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(false);
                  }}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
              {((isFolder && folderColor) || (!isFolder && fileTextColor)) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveColor(e);
                    setShowColorPicker(false);
                  }}
                  className="w-full mb-3 px-3 py-2.5 text-sm text-app-textSecondary hover:text-white hover:bg-app-glassHover/80 rounded-xl transition-colors flex items-center justify-center gap-2 border border-app-glassBorder"
                >
                  <X className="w-4 h-4" />
                  <span>Remover cor</span>
                </button>
              )}
              <div className="grid grid-cols-5 gap-2">
                {FILE_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={(e) => handleColorChange(color, e)}
                    className={`w-8 h-8 rounded-full shadow-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-app-surface focus:ring-app-primary ${(isFolder ? folderColor : fileTextColor) === color ? 'ring-2 ring-white scale-110' : ''
                      }`}
                    style={{ backgroundColor: color }}
                    title={`Usar cor ${color}`}
                    type="button"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
