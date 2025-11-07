import { useEffect, useState, useRef } from 'react';
import { FileItem, FilterType } from '../types';
import { FileRow } from './FileRow';
import { FilterBar } from './FilterBar';
import { listDriveFiles, convertDriveFileToFileItem, isSharedFolder, downloadFile, downloadFolder } from '../lib/googleDrive';
import { getFilesWithAnnotations, getFoldersWithAnnotatedVideos } from '../lib/videoAnnotations';
import { ArrowLeft, Folder, Star, Users, MessageSquare, MoreHorizontal, MoreVertical, Palette, X, Pin, Download, FolderDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { FOLDER_COLOR_OPTIONS, getFolderColor, setFolderColor, removeFolderColor, isFolderPinned, isFolderPinnedSync, togglePinFolder, isFolderFavorite, isFolderFavoriteSync, toggleFavoriteFolder, getFavoritedFolders, FavoritedFolder, FILE_COLOR_OPTIONS, getFileTextColor, setFileTextColor, removeFileTextColor, isFileFavorite, toggleFavoriteFile } from '../lib/savedFolders';

interface FileListProps {
  selectedFile: FileItem | null;
  setSelectedFile: (file: FileItem) => void;
  searchQuery: string;
  setSearchQuery?: (query: string) => void;
  accessToken: string;
  onViewFile?: (file: FileItem) => void;
  viewMode?: 'my-drive' | 'shared-with-me' | 'recent' | 'starred' | 'trash';
  onDownloadStart?: (fileName: string) => string;
  onDownloadProgress?: (id: string, progress: number) => void;
  onDownloadComplete?: (id: string) => void;
  onDownloadError?: (id: string, error: string) => void;
}

interface FolderPath {
  id: string;
  name: string;
}

type SortType = 'name' | 'modifiedDate' | 'size';
type SortDirection = 'asc' | 'desc';

export function FileList({ selectedFile, setSelectedFile, searchQuery, setSearchQuery, accessToken, onViewFile, viewMode = 'my-drive', onDownloadStart, onDownloadProgress, onDownloadComplete, onDownloadError }: FileListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([]);
  const [isCurrentFolderShared, setIsCurrentFolderShared] = useState(false);
  const [filesWithAnnotations, setFilesWithAnnotations] = useState<Set<string>>(new Set());
  const [foldersWithAnnotatedVideos, setFoldersWithAnnotatedVideos] = useState<Set<string>>(new Set());
  const [showBreadcrumbMenu, setShowBreadcrumbMenu] = useState(false);
  const [colorUpdateKey, setColorUpdateKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);
  const [mobileColorPicker, setMobileColorPicker] = useState<string | null>(null);
  const [isMenuOrPickerOpen, setIsMenuOrPickerOpen] = useState(false);
  const [justClosedPicker, setJustClosedPicker] = useState<string | null>(null);
  const [justClosedMenu, setJustClosedMenu] = useState<string | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pinActionRef = useRef<{ folderId: string | null; timestamp: number }>({ folderId: null, timestamp: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTargetRef = useRef<string | null>(null);
  const previousViewModeRef = useRef<'my-drive' | 'shared-with-me' | 'recent' | 'starred' | 'trash'>(viewMode);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartTargetRef = useRef<string | null>(null);

  // Atualiza o ref quando o viewMode muda e garante que não reseta ao navegar
  useEffect(() => {
    // Só atualiza o ref, não faz nenhuma ação que possa resetar a navegação
    previousViewModeRef.current = viewMode;
  }, [viewMode]);

  // Escuta eventos para atualizar cores de pastas e favoritos
  useEffect(() => {
    const handleColorChange = (event: CustomEvent) => {
      setColorUpdateKey((prev) => prev + 1);
    };

    const handlePinnedChange = () => {
      // Atualiza o componente para mostrar os ícones de pin
      setColorUpdateKey((prev) => prev + 1);
    };

    const handleFavoriteChange = async () => {
      // Se estiver no modo 'starred', recarrega a lista de favoritos
      if (viewMode === 'starred') {
        const favoritedFolders = await getFavoritedFolders();
        const favoriteFiles: FileItem[] = favoritedFolders.map((favFolder: FavoritedFolder) => ({
          id: favFolder.id,
          name: favFolder.name,
          originalName: favFolder.name,
          type: 'folder',
          size: '',
          createdDate: '',
          createdTime: '',
          modifiedDate: '',
          modifiedTime: '',
          owner: '',
          shared: false,
          starred: true,
          canDelete: false,
          canShare: false,
          canEdit: false,
          webViewLink: '',
          thumbnailLink: undefined,
          extension: undefined,
          mimeType: 'application/vnd.google-apps.folder',
          videoWidth: undefined,
          videoDuration: undefined,
        }));
        setFiles(favoriteFiles);
      }
      setColorUpdateKey((prev) => prev + 1);
    };

    const handleFileColorChange = () => {
      setColorUpdateKey((prev) => prev + 1);
    };

    const handleFavoriteFileChange = () => {
      setColorUpdateKey((prev) => prev + 1);
    };

    window.addEventListener('folderColorChanged', handleColorChange as EventListener);
    window.addEventListener('pinnedFolderChanged', handlePinnedChange as EventListener);
    window.addEventListener('favoriteFolderChanged', handleFavoriteChange as EventListener);
    window.addEventListener('fileColorChanged', handleFileColorChange as EventListener);
    window.addEventListener('favoriteFileChanged', handleFavoriteFileChange as EventListener);
    return () => {
      window.removeEventListener('folderColorChanged', handleColorChange as EventListener);
      window.removeEventListener('pinnedFolderChanged', handlePinnedChange as EventListener);
      window.removeEventListener('favoriteFolderChanged', handleFavoriteChange as EventListener);
      window.removeEventListener('fileColorChanged', handleFileColorChange as EventListener);
      window.removeEventListener('favoriteFileChanged', handleFavoriteFileChange as EventListener);
    };
  }, [viewMode]);

  // Atualiza flag quando menu ou picker está aberto
  useEffect(() => {
    setIsMenuOrPickerOpen(mobileMenuOpen !== null || mobileColorPicker !== null);
  }, [mobileMenuOpen, mobileColorPicker]);

  // Fecha menu mobile ao clicar fora - APENAS para o menu, não para o picker
  useEffect(() => {
    if (!mobileMenuOpen || mobileColorPicker) return; // Não fecha se o picker estiver aberto

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      
      // Não fecha se clicar no menu ou em botões dentro dele
      if (target.closest('[data-context-menu]') || target.closest('[data-action]')) {
        return;
      }
      
      // Fecha apenas se clicar realmente fora do menu
      setMobileMenuOpen(null);
    };

    // Adiciona delay para evitar que feche imediatamente ao abrir
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [mobileMenuOpen, mobileColorPicker]);

  // Escuta eventos para abrir pastas salvas
  useEffect(() => {
    const handleOpenSavedFolder = async (event: CustomEvent) => {
      const { folderId } = event.detail;
      
      // Busca informações da pasta para obter o nome E verifica se é compartilhada ANTES de setar
      const folderResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,owners,shared,capabilities&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (folderResponse.ok) {
        const folderData = await folderResponse.json();
        if (folderData.name) {
          // Verifica se a pasta é compartilhada usando os dados recebidos
          // Se não pode deletar/compartilhar, ou se não é owner, é compartilhada
          let isShared = folderData.shared === true;
          
          if (!isShared && folderData.capabilities) {
            // Se não pode deletar ou compartilhar, provavelmente não é owner
            isShared = folderData.capabilities.canDelete === false || 
                      folderData.capabilities.canShare === false;
          }
          
          // Se ainda não determinou, tenta verificar via API (mas não bloqueia)
          if (!isShared) {
            isSharedFolder(accessToken, folderId)
              .then(setIsCurrentFolderShared)
              .catch(() => setIsCurrentFolderShared(false));
          } else {
            setIsCurrentFolderShared(true);
          }
          
          setCurrentFolderId(folderId);
          setFolderPath([{ id: folderId, name: folderData.name }]);
          setSelectedFile(null);
        }
      } else {
        // Se não conseguiu acessar, pode ser pasta compartilhada que precisa de parâmetros especiais
        // Tenta buscar com parâmetros de pasta compartilhada
        const sharedFolderResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        if (sharedFolderResponse.ok) {
          const folderData = await sharedFolderResponse.json();
          if (folderData.name) {
            // Se conseguiu acessar com parâmetros de pasta compartilhada, é compartilhada
            setCurrentFolderId(folderId);
            setFolderPath([{ id: folderId, name: folderData.name }]);
            setSelectedFile(null);
            setIsCurrentFolderShared(true);
          }
        }
      }
    };

    window.addEventListener('openSavedFolder', handleOpenSavedFolder as EventListener);
    return () => {
      window.removeEventListener('openSavedFolder', handleOpenSavedFolder as EventListener);
    };
  }, [accessToken, setSelectedFile]);

  // Verifica se a pasta atual é compartilhada
  useEffect(() => {
    if (currentFolderId && accessToken) {
      isSharedFolder(accessToken, currentFolderId)
        .then(setIsCurrentFolderShared)
        .catch(() => setIsCurrentFolderShared(false));
    } else {
      setIsCurrentFolderShared(false);
    }
  }, [currentFolderId, accessToken]);

  // Carrega arquivos com anotações e pastas que contêm vídeos anotados
  useEffect(() => {
    const loadAnnotationsData = async () => {
      try {
        const filesWithAnnots = await getFilesWithAnnotations();
        setFilesWithAnnotations(filesWithAnnots);
        
        // Se houver arquivos com anotações, busca as pastas que os contêm
        if (filesWithAnnots.size > 0 && accessToken) {
          const foldersWithAnnots = await getFoldersWithAnnotatedVideos(accessToken, filesWithAnnots);
          setFoldersWithAnnotatedVideos(foldersWithAnnots);
        } else {
          setFoldersWithAnnotatedVideos(new Set());
        }
      } catch (error) {
        console.error('[FileList] Erro ao carregar dados de anotações:', error);
      }
    };

    // Só carrega se houver acesso ao token
    if (accessToken) {
      loadAnnotationsData();
    }
  }, [accessToken, currentFolderId]); // Recarrega quando muda a pasta atual

  // Função auxiliar para verificar se um arquivo é vídeo
  const isVideoFile = (file: FileItem): boolean => {
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
      const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv', '.mpeg', '.flv', '.mpg', '.m4v', '.3gp'];
      if (videoExts.some(ext => file.extension?.toLowerCase().includes(ext.toLowerCase()))) {
        return true;
      }
    }
    
    // Verifica pelo nome
    if (file.originalName || file.name) {
      const name = (file.originalName || file.name).toLowerCase();
      const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv', '.mpeg', '.flv', '.mpg', '.m4v', '.3gp'];
      if (videoExts.some(ext => name.endsWith(ext))) {
        return true;
      }
    }
    
    return false;
  };

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);

        // NÃO reseta a navegação aqui - a navegação é gerenciada independentemente pelo handleFolderBack
        // O viewMode é gerenciado externamente (App.tsx) e não deve mudar ao navegar entre pastas

        // Se o modo for 'starred' e estiver na raiz (sem currentFolderId), mostra apenas as pastas favoritadas
        if (viewMode === 'starred' && !currentFolderId) {
          const favoritedFolders = await getFavoritedFolders();
          // Converte as pastas favoritadas para FileItem
          const favoriteFiles: FileItem[] = favoritedFolders.map((favFolder: FavoritedFolder) => ({
            id: favFolder.id,
            name: favFolder.name,
            originalName: favFolder.name,
            type: 'folder',
            size: '',
            createdDate: '',
            createdTime: '',
            modifiedDate: '',
            modifiedTime: '',
            owner: '',
            shared: false,
            starred: true,
            canDelete: false,
            canShare: false,
            canEdit: false,
            webViewLink: '',
            thumbnailLink: undefined,
            extension: undefined,
            mimeType: 'application/vnd.google-apps.folder',
            videoWidth: undefined,
            videoDuration: undefined,
          }));
          setFiles(favoriteFiles);
          setLoading(false);
          return;
        }

        // Se estiver dentro de uma pasta (mesmo no modo starred), busca os arquivos do Google Drive
        // Mas precisa ter accessToken
        if (!accessToken && viewMode === 'starred' && currentFolderId) {
          setLoading(false);
          setError('Token de acesso necessário para visualizar o conteúdo da pasta');
          setFiles([]);
          return;
        }

        const sharedWithMe = viewMode === 'shared-with-me';
        
        const response = await listDriveFiles(
          accessToken, 
          searchQuery, 
          undefined, 
          currentFolderId || undefined,
          sharedWithMe,
          isCurrentFolderShared // Indica se a pasta atual é compartilhada
        );
        const mappedFiles = (response.files || []).map(convertDriveFileToFileItem);
        
        setFiles(mappedFiles);
      } catch (err: any) {
        console.error('Erro ao buscar arquivos:', err);
        setError(err.message || 'Erro ao carregar arquivos do Google Drive');
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    // Busca arquivos se tiver accessToken ou se estiver no modo starred (mesmo sem accessToken, mostra apenas lista de favoritos na raiz)
    if (accessToken || (viewMode === 'starred' && !currentFolderId)) {
      fetchFiles();
    } else if (viewMode === 'starred' && currentFolderId) {
      // Se estiver no modo starred e dentro de uma pasta, precisa de accessToken
      setLoading(false);
      setError('Token de acesso necessário para visualizar o conteúdo da pasta');
      setFiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, searchQuery, currentFolderId, viewMode, isCurrentFolderShared]);

  const handleFolderOpen = async (folder: FileItem) => {
    if (folder.type === 'folder') {
      // Se estiver no modo 'starred', sai do modo favoritos ao entrar em uma pasta
      if (viewMode === 'starred') {
        // Não permite navegação dentro de favoritos, volta para 'my-drive'
        // ou mantém o modo mas permite navegação
        // Por enquanto, vamos permitir navegação mantendo o modo
      }
      
      // Permite navegar dentro de pastas compartilhadas também
      setCurrentFolderId(folder.id);
      setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
      setSelectedFile(null);
      
      // Verifica se a nova pasta é compartilhada usando as informações do arquivo
      // Se o arquivo já tem informações de shared ou capabilities, usa isso
      if (folder.shared === true || (folder.canDelete === false || folder.canShare === false)) {
        setIsCurrentFolderShared(true);
      } else if (accessToken) {
        // Se não tem informações suficientes, verifica via API
        isSharedFolder(accessToken, folder.id)
          .then(setIsCurrentFolderShared)
          .catch(() => setIsCurrentFolderShared(false));
      }
    }
  };

  const handleFolderBack = async (index?: number) => {
    let newFolderId: string | null = null;
    
    if (index === undefined) {
      // Voltar para a pasta anterior no caminho
      if (folderPath.length > 1) {
        // Se há mais de uma pasta no caminho, volta para a anterior
        const newPath = folderPath.slice(0, -1); // Remove a última pasta
        setFolderPath(newPath);
        newFolderId = newPath[newPath.length - 1].id;
        setCurrentFolderId(newFolderId);
      } else if (folderPath.length === 1) {
        // Se há apenas uma pasta, volta para a raiz (mas não reseta o viewMode)
        newFolderId = null;
        setCurrentFolderId(null);
        setFolderPath([]);
        setIsCurrentFolderShared(false);
      }
      // Se folderPath.length === 0, não faz nada (botão não aparece)
    } else {
      // Voltar para uma pasta específica no caminho (usado pelo breadcrumb)
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      if (index === -1 || newPath.length === 0) {
        // Volta para a raiz
        newFolderId = null;
        setCurrentFolderId(null);
        setIsCurrentFolderShared(false);
      } else {
        // Volta para uma pasta específica no caminho
        newFolderId = newPath[newPath.length - 1].id;
        setCurrentFolderId(newFolderId);
      }
    }
    
    // Limpa o arquivo selecionado
    setSelectedFile(null);
    
    // Verifica se a pasta de destino é compartilhada (apenas se não for raiz)
    if (newFolderId && accessToken) {
      isSharedFolder(accessToken, newFolderId)
        .then(setIsCurrentFolderShared)
        .catch(() => setIsCurrentFolderShared(false));
    } else if (!newFolderId && folderPath.length === 0) {
      // Se voltou para a raiz, garante que não é compartilhada
      setIsCurrentFolderShared(false);
    }
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());

    // Se o modo for 'starred' e estiver na raiz (sem currentFolderId), mostra apenas pastas favoritadas
    if (viewMode === 'starred' && !currentFolderId) {
      return matchesSearch && file.type === 'folder' && isFolderFavorite(file.id);
    }

    // Se estiver dentro de uma pasta (mesmo no modo starred), mostra todos os arquivos normalmente
    if (filter === 'all') return matchesSearch;
    if (filter === 'image') return matchesSearch && (file.type === 'png' || file.type === 'jpg');
    if (filter === 'video') return matchesSearch && file.type === 'video';
    return matchesSearch && file.type === filter;
  });

  // Função de ordenação
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let comparison = 0;

    switch (sortType) {
      case 'name':
        const nameA = (a.originalName || a.name || '').toLowerCase();
        const nameB = (b.originalName || b.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        break;
      
      case 'modifiedDate':
        // Converte as datas para comparação
        // modifiedTime pode ser uma string ISO ou formatada, tenta parsear
        let dateA = 0;
        let dateB = 0;
        
        if (a.modifiedTime) {
          const parsedA = new Date(a.modifiedTime);
          dateA = isNaN(parsedA.getTime()) ? 0 : parsedA.getTime();
        }
        
        if (b.modifiedTime) {
          const parsedB = new Date(b.modifiedTime);
          dateB = isNaN(parsedB.getTime()) ? 0 : parsedB.getTime();
        }
        
        // Se não conseguiu parsear, tenta usar createdTime como fallback
        if (dateA === 0 && a.createdTime) {
          const parsedA = new Date(a.createdTime);
          dateA = isNaN(parsedA.getTime()) ? 0 : parsedA.getTime();
        }
        
        if (dateB === 0 && b.createdTime) {
          const parsedB = new Date(b.createdTime);
          dateB = isNaN(parsedB.getTime()) ? 0 : parsedB.getTime();
        }
        
        comparison = dateA - dateB;
        break;
      
      case 'size':
        // Compara tamanhos em bytes, se disponível
        // Pastas vão para o final (ou início, dependendo da direção)
        const isFolderA = a.type === 'folder';
        const isFolderB = b.type === 'folder';
        
        if (isFolderA && isFolderB) {
          // Se ambos são pastas, ordena por nome
          const nameA = (a.originalName || a.name || '').toLowerCase();
          const nameB = (b.originalName || b.name || '').toLowerCase();
          comparison = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        } else if (isFolderA) {
          // Pastas vão para o final quando ordenando por tamanho
          comparison = 1;
        } else if (isFolderB) {
          // Pastas vão para o final quando ordenando por tamanho
          comparison = -1;
        } else {
          // Ambos são arquivos, compara por tamanho
          const sizeA = a.sizeBytes || 0;
          const sizeB = b.sizeBytes || 0;
          comparison = sizeA - sizeB;
        }
        break;
    }

    // Aplica a direção da ordenação
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (type: SortType) => {
    if (sortType === type) {
      // Se já está ordenando por este tipo, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Se é um novo tipo, define como ascendente
      setSortType(type);
      setSortDirection('asc');
    }
  };

  const getCurrentTitle = () => {
    // Se estiver dentro de uma pasta, mostra o nome da pasta atual
    if (folderPath.length > 0) {
      return folderPath[folderPath.length - 1].name;
    }
    
    // Se estiver na raiz, mostra o título baseado no viewMode
    if (viewMode === 'shared-with-me') {
      return 'Compartilhados comigo';
    }
    if (viewMode === 'starred') {
      return 'Favoritos';
    }
    if (viewMode === 'recent') {
      return 'Recentes';
    }
    if (viewMode === 'trash') {
      return 'Lixeira';
    }
    return 'Meu Drive';
  };

  const currentFolderName = getCurrentTitle();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-2">
          {folderPath.length > 0 && (
            <button
              onClick={() => handleFolderBack()}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title={`Voltar para ${getCurrentTitle()}`}
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
          )}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold sm:font-semibold text-white truncate flex-1">{currentFolderName}</h1>
        </div>
        
        {/* Breadcrumbs - Desktop: completo, Mobile: simplificado */}
        {folderPath.length > 0 && (
          <>
            {/* Mobile: Breadcrumb simplificado - apenas mostra o nome da pasta atual */}
            <div className="sm:hidden flex items-center gap-2 text-xs text-gray-400 mb-2">
              <span className="text-white font-medium truncate flex-1">
                {folderPath.length > 0 ? folderPath[folderPath.length - 1].name : currentFolderName}
              </span>
              {folderPath.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setShowBreadcrumbMenu(!showBreadcrumbMenu)}
                    className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
                    title="Ver caminho completo"
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                  {showBreadcrumbMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 sm:hidden"
                        onClick={() => setShowBreadcrumbMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl min-w-[200px] z-50 max-h-[60vh] overflow-y-auto">
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => {
                              handleFolderBack();
                              setShowBreadcrumbMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            {viewMode === 'shared-with-me' ? 'Compartilhados comigo' :
                             viewMode === 'starred' ? 'Favoritos' :
                             viewMode === 'recent' ? 'Recentes' :
                             viewMode === 'trash' ? 'Lixeira' :
                             'Meu Drive'}
                          </button>
                          {folderPath.map((folder, index) => (
                            <button
                              key={folder.id}
                              onClick={() => {
                                handleFolderBack(index);
                                setShowBreadcrumbMenu(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                            >
                              {folder.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Desktop: Breadcrumb completo */}
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400 mb-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => handleFolderBack()}
                className="hover:text-white transition-colors whitespace-nowrap"
              >
                {folderPath.length === 0 ? currentFolderName : (
                  viewMode === 'shared-with-me' ? 'Compartilhados comigo' :
                  viewMode === 'starred' ? 'Favoritos' :
                  viewMode === 'recent' ? 'Recentes' :
                  viewMode === 'trash' ? 'Lixeira' :
                  'Meu Drive'
                )}
              </button>
              {folderPath.map((folder, index) => (
                <span key={folder.id} className="flex items-center gap-2 whitespace-nowrap">
                  <span>/</span>
                  <button
                    onClick={() => handleFolderBack(index)}
                    className="hover:text-white transition-colors truncate"
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
        
        <p className="text-gray-500 text-xs sm:text-sm hidden sm:block">
          {searchQuery 
            ? `Resultados da busca: "${searchQuery}"` 
            : viewMode === 'shared-with-me' 
              ? 'Arquivos e pastas compartilhados com você' 
              : 'Todos os seus arquivos em um só lugar'}
        </p>
      </div>

      <FilterBar filter={filter} setFilter={setFilter} />

      {/* Controles de ordenação - Mobile */}
      <div className="lg:hidden px-3 sm:px-6 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Ordenar por:</span>
          <select
            value={sortType}
            onChange={(e) => {
              const newType = e.target.value as SortType;
              handleSort(newType);
            }}
            className="bg-[#1a1a1a] border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="name">Nome</option>
            <option value="modifiedDate">Data de modificação</option>
            <option value="size">Tamanho</option>
          </select>
          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
            title={sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ArrowDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Desktop: Tabela */}
        <div className="hidden lg:block px-3 sm:px-6">
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-[#141414]">
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-400 group">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
                    >
                      Nome
                      {sortType === 'name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-4 h-4 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-4 h-4 opacity-30 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-400">Proprietário</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-400 group">
                    <button
                      onClick={() => handleSort('modifiedDate')}
                      className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
                    >
                      Última modificação
                      {sortType === 'modifiedDate' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-4 h-4 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-4 h-4 opacity-30 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-400 group">
                    <button
                      onClick={() => handleSort('size')}
                      className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
                    >
                      Tamanho
                      {sortType === 'size' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-4 h-4 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-4 h-4 opacity-30 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-center text-gray-400">
                      Carregando arquivos...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-center">
                      <div className="text-red-400 mb-2">{error}</div>
                      <div className="text-sm text-gray-500">
                        Verifique sua conexão e tente novamente.
                      </div>
                    </td>
                  </tr>
                ) : filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-center text-gray-400">
                      {searchQuery ? 'Nenhum arquivo encontrado para esta pesquisa' : 'Nenhum arquivo encontrado'}
                    </td>
                  </tr>
                ) : (
                  sortedFiles.map((file, index) => {
                    // Verifica se é vídeo e tem anotações
                    const isVideo = isVideoFile(file);
                    const hasAnnots = isVideo && filesWithAnnotations.has(file.id);
                    
                    // Verifica se é pasta que contém vídeos com anotações
                    const folderHasAnnotatedVideos = file.type === 'folder' && foldersWithAnnotatedVideos.has(file.id);
                    
                    // Logs de debug removidos para reduzir poluição no console
                    
                    return (
                    <FileRow
                      key={`${file.id}-${colorUpdateKey}`}
                      file={file}
                      isSelected={selectedFile?.id === file.id}
                      onClick={() => {
                        if (file.type === 'folder') {
                          // Clique simples abre a pasta também
                          handleFolderOpen(file);
                        } else {
                          setSelectedFile(file);
                        }
                      }}
                      onDoubleClick={() => {
                        if (file.type === 'folder') {
                          handleFolderOpen(file);
                        } else if (onViewFile) {
                          onViewFile(file);
                        }
                      }}
                      isEven={index % 2 === 0}
                      hasAnnotations={hasAnnots || folderHasAnnotatedVideos}
                      onColorChange={() => setColorUpdateKey((prev) => prev + 1)}
                      accessToken={accessToken}
                      onDownloadStart={onDownloadStart}
                      onDownloadProgress={onDownloadProgress}
                      onDownloadComplete={onDownloadComplete}
                      onDownloadError={onDownloadError}
                    />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Mobile: Cards */}
        <div className="lg:hidden px-3 sm:px-6 pb-4">
          {loading ? (
            <div className="py-8 text-center text-gray-400">
              Carregando arquivos...
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <div className="text-red-400 mb-2">{error}</div>
              <div className="text-sm text-gray-500">
                Verifique sua conexão e tente novamente.
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              {searchQuery ? 'Nenhum arquivo encontrado para esta pesquisa' : 'Nenhum arquivo encontrado'}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFiles.map((file, index) => {
                const isVideo = isVideoFile(file);
                const hasAnnots = isVideo && filesWithAnnotations.has(file.id);
                const folderHasAnnotatedVideos = file.type === 'folder' && foldersWithAnnotatedVideos.has(file.id);
                
                // Logs de debug removidos para reduzir poluição no console
                
                // Remove extensão do nome para exibição
                const displayName = (file.originalName || file.name || '').replace(/\.(mp4|pdf|zip|docx|xlsx|pptx|png|jpg)$/i, '');
                
                return (
                  <div
                    key={`${file.id}-${colorUpdateKey}`}
                    onContextMenu={(e) => {
                      // Menu de contexto no desktop (clique direito)
                      e.preventDefault();
                      e.stopPropagation();
                      setMobileMenuOpen(file.id);
                      setMobileColorPicker(null);
                    }}
                    onClick={(e) => {
                      const isMobile = window.innerWidth < 1024;
                      
                      // Não abre se clicar no menu contextual ou se qualquer menu/picker estiver aberto
                      const target = e.target as HTMLElement;
                      if (target.closest('.menu-contextual') || target.closest('[data-context-menu]') || target.closest('[data-color-picker]')) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      
                      // Se justClosedMenu está ativo, previne abrir pasta (mas permite arquivos)
                      if (justClosedMenu === file.id && file.type === 'folder') {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      
                      // Se qualquer menu ou picker estiver aberto, não abre
                      if (isMenuOrPickerOpen || mobileMenuOpen === file.id || mobileColorPicker === file.id || justClosedPicker === file.id || (justClosedMenu === file.id && file.type === 'folder')) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      
                      // Desktop: clique simples abre pasta ou seleciona arquivo
                      if (!isMobile) {
                        if (file.type === 'folder') {
                          handleFolderOpen(file);
                        } else {
                          setSelectedFile(file);
                        }
                      } else {
                        // Mobile: clique simples abre pasta (double click também funciona como backup)
                        // No mobile, pastas são abertas via clique simples OU double click
                        if (file.type === 'folder') {
                          handleFolderOpen(file);
                        } else {
                          setSelectedFile(file);
                        }
                      }
                    }}
                    onTouchStart={(e) => {
                      // No mobile, detecta long press para pastas e arquivos
                      if (!file.id) return;
                      
                      // Registra o tempo e o target do touch
                      touchStartTimeRef.current = Date.now();
                      touchStartTargetRef.current = file.id;
                      
                      // Previne touch se menu/picker estiver aberto ou acabou de fechar
                      const target = e.target as HTMLElement;
                      if (target.closest('.menu-contextual') || target.closest('[data-context-menu]') || target.closest('[data-color-picker]')) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      if (justClosedMenu === file.id || isMenuOrPickerOpen || mobileMenuOpen === file.id || mobileColorPicker === file.id || justClosedPicker === file.id || justClosedMenu === file.id) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      
                      // Limpa qualquer timer anterior para evitar conflitos
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      
                      // Inicia timer para long press (2 segundos para abrir menu de opções)
                      // Salva a referência do arquivo para verificar depois
                      const fileId = file.id;
                      longPressTargetRef.current = fileId;
                      longPressTimerRef.current = setTimeout(() => {
                        // Verifica se ainda é o mesmo arquivo
                        if (longPressTargetRef.current === fileId && fileId) {
                          // Abre o menu apenas se ainda estiver segurando por 2 segundos
                          setMobileMenuOpen(fileId);
                          setMobileColorPicker(null);
                          // Limpa a referência
                          longPressTargetRef.current = null;
                          touchStartTargetRef.current = null;
                        }
                      }, 2000); // 2 segundos de pressão para abrir o menu
                    }}
                    onTouchEnd={(e) => {
                      // Cancela o long press se o usuário soltar antes de 2 segundos
                      // Mas só cancela se realmente for um toque rápido (não um long press completo)
                      if (mobileMenuOpen === file.id) {
                        // Menu já abriu (long press completo de 2 segundos), não cancela nada
                        return;
                      }
                      
                      // Se o menu não abriu, cancela o timer se ainda estiver ativo
                      if (longPressTimerRef.current && longPressTargetRef.current === file.id) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                        longPressTargetRef.current = null;
                        touchStartTargetRef.current = null;
                      }
                    }}
                    onTouchCancel={(e) => {
                      // Cancela o long press se o touch for cancelado
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      longPressTargetRef.current = null;
                      touchStartTargetRef.current = null;
                    }}
                    onMouseDown={(e) => {
                      // No desktop, permite clique normal - menu aparece apenas com clique direito
                    }}
                    onDoubleClick={(e) => {
                      // Não abre se qualquer menu/picker estiver aberto ou acabou de fechar
                      if (isMenuOrPickerOpen || mobileMenuOpen === file.id || mobileColorPicker === file.id || justClosedPicker === file.id || justClosedMenu === file.id) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      
                      // Double click abre pasta ou arquivo (funciona em desktop e mobile como backup)
                      e.stopPropagation();
                      if (file.type === 'folder') {
                        e.preventDefault();
                        handleFolderOpen(file);
                      } else if (onViewFile) {
                        e.preventDefault();
                        onViewFile(file);
                      }
                    }}
                    className={`
                      bg-[#1a1a1a] border border-gray-800/50 rounded-2xl p-3 min-h-[48px]
                      transition-all duration-200 fade-in
                      ${selectedFile?.id === file.id
                        ? 'bg-blue-600/20 border-blue-600/50 shadow-lg shadow-blue-600/10'
                        : 'hover:bg-[#1f1f1f] active:bg-[#252525]'
                      }
                      ${(mobileMenuOpen === file.id || mobileColorPicker === file.id || isMenuOrPickerOpen || justClosedPicker === file.id || justClosedMenu === file.id) 
                        ? '' 
                        : 'cursor-pointer active:scale-[0.98]'
                      }
                    `}
                    style={{ overflow: 'visible', position: 'relative' }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3" style={{ overflow: 'visible', width: '100%', position: 'relative' }}>
                      <div className="flex-shrink-0">
                        <FileIcon type={file.type} folderId={file.type === 'folder' ? file.id : undefined} />
                      </div>
                      <div className="flex-1 min-w-0" style={{ overflow: 'visible', flexShrink: 1 }}>
                        <div className="flex items-center gap-2 flex-wrap" style={{ overflow: 'visible' }}>
                          <h3 className="font-semibold text-sm sm:text-base truncate leading-tight mb-0.5 flex-1 min-w-0" style={{ color: file.type !== 'folder' && file.id ? (getFileTextColor(file.id) || 'white') : 'white' }}>
                            {displayName}
                          </h3>
                          {/* Ícone de anotações ao lado do nome no mobile */}
                          {(hasAnnots || folderHasAnnotatedVideos) && (
                            <div title={file.type === 'folder' ? 'Contém vídeos com anotações' : 'Tem anotações'}>
                              <MessageSquare 
                                className="w-5 h-5 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500/40 sm:fill-yellow-500/20 flex-shrink-0" 
                                style={{ 
                                display: 'block',
                                minWidth: '20px',
                                minHeight: '20px',
                                width: '20px',
                                height: '20px',
                                flexShrink: 0,
                                visibility: 'visible',
                                opacity: 1,
                                color: '#eab308',
                                fill: 'rgba(234, 179, 8, 0.4)'
                              }}
                            />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <span className="truncate max-w-[120px]">{file.owner}</span>
                          <span className="flex-shrink-0">•</span>
                          <span className="flex-shrink-0">{file.size}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0 ml-1 sm:ml-2" style={{ overflow: 'visible', minWidth: '60px', flexBasis: 'auto' }}>
                        <div className="flex items-center gap-0.5 sm:gap-1" style={{ overflow: 'visible', width: '100%', justifyContent: 'flex-end' }}>
                          {file.starred && (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                          )}
                          {file.type === 'folder' && file.id && isFolderPinnedSync(file.id) && (
                            <Pin className="w-4 h-4 text-blue-400 fill-blue-400 flex-shrink-0" />
                          )}
                          {file.type === 'folder' && file.id && isFolderFavoriteSync(file.id) && (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                          )}
                          {file.type !== 'folder' && file.id && isFileFavorite(file.id) && (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                          )}
                          {file.shared && (
                            <Users className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                        
                      {/* Menu de contexto para pastas e arquivos - aparece ao pressionar */}
                      {mobileMenuOpen === file.id && !mobileColorPicker && (
                          <>
                            <div 
                              className="fixed inset-0 z-[105] lg:hidden bg-black/30"
                              style={{ pointerEvents: 'auto', touchAction: 'none' }}
                            />
                            <div
                              data-context-menu
                              className="fixed bottom-20 left-4 right-4 lg:absolute lg:right-0 lg:top-full lg:bottom-auto lg:left-auto lg:mt-2 lg:w-64 bg-[#1f1f1f] border border-gray-800 rounded-lg shadow-xl z-[106]"
                              onClick={(e) => {
                                // Previne que o clique propague para fechar o menu, mas permite que botões funcionem
                                if (!(e.target as HTMLElement).closest('button')) {
                                  e.stopPropagation();
                                }
                              }}
                              onTouchStart={(e) => {
                                // Previne que o touch propague para fechar o menu, mas permite que botões funcionem
                                if (!(e.target as HTMLElement).closest('button')) {
                                  e.stopPropagation();
                                }
                              }}
                              style={{ pointerEvents: 'auto' }}
                            >
                              <div className="p-3">
                                <h3 className="text-sm font-semibold text-white mb-3 px-2">{file.name || file.originalName || (file.type === 'folder' ? 'Pasta' : 'Arquivo')}</h3>
                                
                                {file.type === 'folder' ? (
                                  <>
                                {/* Opção: Favoritar/Desfavoritar */}
                                <button
                                  data-action="favorite"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (file.id && justClosedMenu !== file.id) {
                                      setJustClosedMenu(file.id);
                                      const folderName = file.name || file.originalName || '';
                                      toggleFavoriteFolder(file.id, folderName);
                                      setColorUpdateKey((prev) => prev + 1);
                                      requestAnimationFrame(() => {
                                        window.dispatchEvent(new CustomEvent('favoriteFolderChanged', { detail: { folderId: file.id } }));
                                      });
                                      // Fecha o menu após um pequeno delay
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                        setTimeout(() => {
                                          setJustClosedMenu(null);
                                        }, 800);
                                      }, 300);
                                    }
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    // Executa imediatamente no mobile
                                    if (file.id && justClosedMenu !== file.id) {
                                      setJustClosedMenu(file.id);
                                      const folderName = file.name || file.originalName || '';
                                      toggleFavoriteFolder(file.id, folderName);
                                      setColorUpdateKey((prev) => prev + 1);
                                      requestAnimationFrame(() => {
                                        window.dispatchEvent(new CustomEvent('favoriteFolderChanged', { detail: { folderId: file.id } }));
                                      });
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                        setTimeout(() => {
                                          setJustClosedMenu(null);
                                        }, 800);
                                      }, 300);
                                    }
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                  style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                >
                                  <Star className={`w-5 h-5 ${isFolderFavoriteSync(file.id) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`} />
                                  <span className="flex-1">{isFolderFavoriteSync(file.id) ? 'Remover dos favoritos' : 'Favoritar'}</span>
                                </button>
                                
                                {/* Opção: Fixar/Desfixar */}
                                <button
                                  data-action="pin"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const now = Date.now();
                                    if (pinActionRef.current.folderId === file.id && now - pinActionRef.current.timestamp < 300) {
                                      return;
                                    }
                                    if (file.id) {
                                      pinActionRef.current = { folderId: file.id, timestamp: now };
                                      const folderName = file.name || file.originalName || '';
                                      togglePinFolder(file.id, folderName);
                                      setColorUpdateKey((prev) => prev + 1);
                                      requestAnimationFrame(() => {
                                        window.dispatchEvent(new CustomEvent('pinnedFolderChanged', { detail: { folderId: file.id } }));
                                      });
                                      // Fecha o menu após um pequeno delay
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                      }, 300);
                                    }
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    // Executa imediatamente no mobile
                                    const now = Date.now();
                                    if (pinActionRef.current.folderId === file.id && now - pinActionRef.current.timestamp < 300) {
                                      return;
                                    }
                                    if (file.id) {
                                      pinActionRef.current = { folderId: file.id, timestamp: now };
                                      const folderName = file.name || file.originalName || '';
                                      togglePinFolder(file.id, folderName);
                                      setColorUpdateKey((prev) => prev + 1);
                                      requestAnimationFrame(() => {
                                        window.dispatchEvent(new CustomEvent('pinnedFolderChanged', { detail: { folderId: file.id } }));
                                      });
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                      }, 300);
                                    }
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                  style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                >
                                  <Pin className={`w-5 h-5 ${isFolderPinnedSync(file.id) ? 'text-blue-400 fill-blue-400' : 'text-gray-400'}`} />
                                  <span className="flex-1">{isFolderPinnedSync(file.id) ? 'Desfixar' : 'Fixar'}</span>
                                </button>
                                
                                {/* Opção: Mudar cor */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (file.id) {
                                      requestAnimationFrame(() => {
                                        setMobileColorPicker(file.id);
                                        setMobileMenuOpen(null);
                                      });
                                    }
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    // Executa imediatamente no mobile
                                    if (file.id) {
                                      requestAnimationFrame(() => {
                                        setMobileColorPicker(file.id);
                                        setMobileMenuOpen(null);
                                      });
                                    }
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                  style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                >
                                  <Palette className="w-5 h-5" style={getFolderColor(file.id) ? { color: getFolderColor(file.id)! } : undefined} />
                                  <span className="flex-1">Mudar cor</span>
                                </button>
                                
                                {/* Opção: Remover cor (apenas se houver cor aplicada) */}
                                {getFolderColor(file.id) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (file.id && justClosedMenu !== file.id) {
                                        setJustClosedMenu(file.id);
                                        removeFolderColor(file.id);
                                        setColorUpdateKey((prev) => prev + 1);
                                        requestAnimationFrame(() => {
                                          window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color: null } }));
                                        });
                                        setTimeout(() => {
                                          setMobileMenuOpen(null);
                                          setTimeout(() => {
                                            setJustClosedMenu(null);
                                          }, 800);
                                        }, 300);
                                      }
                                    }}
                                    onTouchStart={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (file.id && justClosedMenu !== file.id) {
                                        setJustClosedMenu(file.id);
                                        removeFolderColor(file.id);
                                        setColorUpdateKey((prev) => prev + 1);
                                        requestAnimationFrame(() => {
                                          window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color: null } }));
                                        });
                                        setTimeout(() => {
                                          setMobileMenuOpen(null);
                                          setTimeout(() => {
                                            setJustClosedMenu(null);
                                          }, 800);
                                        }, 300);
                                      }
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                    style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                  >
                                    <X className="w-5 h-5" />
                                    <span className="flex-1">Remover cor</span>
                                  </button>
                                )}
                                
                                {/* Opção: Baixar pasta */}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    if (!file.id) {
                                      console.warn('[FileList] Sem ID da pasta');
                                      alert('ID da pasta não encontrado.');
                                      return;
                                    }
                                    
                                    if (!accessToken) {
                                      console.warn('[FileList] Sem accessToken');
                                      alert('Token de acesso necessário. Faça login novamente.');
                                      return;
                                    }
                                    
                                    if (justClosedMenu === file.id) {
                                      return; // Evita execução duplicada
                                    }
                                    
                                    setJustClosedMenu(file.id);
                                    
                                    const folderName = file.name || file.originalName || 'Pasta';
                                    console.log('[FileList] Iniciando download da pasta:', folderName, file.id);
                                    
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
                                      
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                        setTimeout(() => {
                                          setJustClosedMenu(null);
                                        }, 800);
                                      }, 300);
                                    } catch (error: any) {
                                      console.error('[FileList] Erro ao baixar pasta:', error);
                                      if (folderDownloadId && onDownloadError) {
                                        onDownloadError(folderDownloadId, error.message || 'Erro ao baixar pasta');
                                      } else {
                                        alert(error.message || 'Erro ao baixar pasta. Verifique o console para mais detalhes.');
                                      }
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                        setTimeout(() => {
                                          setJustClosedMenu(null);
                                        }, 800);
                                      }, 300);
                                    }
                                  }}
                                  onTouchStart={async (e) => {
                                    e.stopPropagation();
                                    // Não usa preventDefault em touchStart passivo, apenas previne propagação
                                    
                                    if (!file.id) {
                                      console.warn('[FileList] Sem ID da pasta (touch)');
                                      alert('ID da pasta não encontrado.');
                                      return;
                                    }
                                    
                                    if (!accessToken) {
                                      console.warn('[FileList] Sem accessToken (touch)');
                                      alert('Token de acesso necessário. Faça login novamente.');
                                      return;
                                    }
                                    
                                    if (justClosedMenu === file.id) {
                                      return; // Evita execução duplicada
                                    }
                                    
                                    setJustClosedMenu(file.id);
                                    
                                    const folderName = file.name || file.originalName || 'Pasta';
                                    console.log('[FileList] Iniciando download da pasta (touch):', folderName, file.id);
                                    
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
                                      
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                        setTimeout(() => {
                                          setJustClosedMenu(null);
                                        }, 800);
                                      }, 300);
                                    } catch (error: any) {
                                      console.error('[FileList] Erro ao baixar pasta (touch):', error);
                                      if (folderDownloadId && onDownloadError) {
                                        onDownloadError(folderDownloadId, error.message || 'Erro ao baixar pasta');
                                      } else {
                                        alert(error.message || 'Erro ao baixar pasta. Verifique o console para mais detalhes.');
                                      }
                                      setTimeout(() => {
                                        setMobileMenuOpen(null);
                                        setTimeout(() => {
                                          setJustClosedMenu(null);
                                        }, 800);
                                      }, 300);
                                    }
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                  style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                                  title="Baixar pasta inteira"
                                >
                                  <FolderDown className="w-5 h-5 text-blue-400" />
                                  <span className="flex-1">Baixar pasta</span>
                                </button>
                                  </>
                                ) : (
                                  <>
                                    {/* Opção: Favoritar/Desfavoritar para arquivos */}
                                    <button
                                      data-action="favorite"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (file.id && justClosedMenu !== file.id) {
                                          setJustClosedMenu(file.id);
                                          toggleFavoriteFile(file.id);
                                          setColorUpdateKey((prev) => prev + 1);
                                          requestAnimationFrame(() => {
                                            window.dispatchEvent(new CustomEvent('favoriteFileChanged', { detail: { fileId: file.id } }));
                                          });
                                          setTimeout(() => {
                                            setMobileMenuOpen(null);
                                            setTimeout(() => {
                                              setJustClosedMenu(null);
                                            }, 800);
                                          }, 300);
                                        }
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (file.id && justClosedMenu !== file.id) {
                                          setJustClosedMenu(file.id);
                                          toggleFavoriteFile(file.id);
                                          setColorUpdateKey((prev) => prev + 1);
                                          requestAnimationFrame(() => {
                                            window.dispatchEvent(new CustomEvent('favoriteFileChanged', { detail: { fileId: file.id } }));
                                          });
                                          setTimeout(() => {
                                            setMobileMenuOpen(null);
                                            setTimeout(() => {
                                              setJustClosedMenu(null);
                                            }, 800);
                                          }, 300);
                                        }
                                      }}
                                      className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                      style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                    >
                                      <Star className={`w-5 h-5 ${isFileFavorite(file.id) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`} />
                                      <span className="flex-1">{isFileFavorite(file.id) ? 'Remover dos favoritos' : 'Favoritar'}</span>
                                    </button>
                                    
                                    {/* Opção: Mudar cor do texto para arquivos */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (file.id) {
                                          requestAnimationFrame(() => {
                                            setMobileColorPicker(file.id);
                                            setMobileMenuOpen(null);
                                          });
                                        }
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (file.id) {
                                          requestAnimationFrame(() => {
                                            setMobileColorPicker(file.id);
                                            setMobileMenuOpen(null);
                                          });
                                        }
                                      }}
                                      className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                      style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                    >
                                      <Palette className="w-5 h-5" style={getFileTextColor(file.id) ? { color: getFileTextColor(file.id)! } : undefined} />
                                      <span className="flex-1">Mudar cor do texto</span>
                                    </button>
                                    
                                    {/* Opção: Remover cor do texto (apenas se houver cor aplicada) */}
                                    {getFileTextColor(file.id) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (file.id && justClosedMenu !== file.id) {
                                            setJustClosedMenu(file.id);
                                            removeFileTextColor(file.id);
                                            setColorUpdateKey((prev) => prev + 1);
                                            requestAnimationFrame(() => {
                                              window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color: null } }));
                                            });
                                            setTimeout(() => {
                                              setMobileMenuOpen(null);
                                              setTimeout(() => {
                                                setJustClosedMenu(null);
                                              }, 800);
                                            }, 300);
                                          }
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (file.id && justClosedMenu !== file.id) {
                                            setJustClosedMenu(file.id);
                                            removeFileTextColor(file.id);
                                            setColorUpdateKey((prev) => prev + 1);
                                            requestAnimationFrame(() => {
                                              window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color: null } }));
                                            });
                                            setTimeout(() => {
                                              setMobileMenuOpen(null);
                                              setTimeout(() => {
                                                setJustClosedMenu(null);
                                              }, 800);
                                            }, 300);
                                          }
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation mb-2"
                                        style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                      >
                                        <X className="w-5 h-5" />
                                        <span className="flex-1">Remover cor</span>
                                      </button>
                                    )}
                                    
                                    {/* Opção: Baixar arquivo */}
                                    <button
                                      data-action="download"
                                      onClick={async (e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (file.id && file.canDownload && accessToken && justClosedMenu !== file.id) {
                                        setJustClosedMenu(file.id);
                                        
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
                                          
                                          setTimeout(() => {
                                            setMobileMenuOpen(null);
                                            setTimeout(() => {
                                              setJustClosedMenu(null);
                                            }, 800);
                                          }, 300);
                                        } catch (error: any) {
                                          if (downloadId && onDownloadError) {
                                            onDownloadError(downloadId, error.message || 'Erro ao baixar o arquivo');
                                          } else {
                                            alert(error.message || 'Erro ao baixar o arquivo');
                                          }
                                          setTimeout(() => {
                                            setMobileMenuOpen(null);
                                            setTimeout(() => {
                                              setJustClosedMenu(null);
                                            }, 800);
                                          }, 300);
                                        }
                                      }
                                    }}
                                    onTouchStart={async (e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (file.id && file.canDownload && accessToken && justClosedMenu !== file.id) {
                                        setJustClosedMenu(file.id);
                                        
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
                                          
                                          setTimeout(() => {
                                            setMobileMenuOpen(null);
                                            setTimeout(() => {
                                              setJustClosedMenu(null);
                                            }, 800);
                                          }, 300);
                                        } catch (error: any) {
                                          if (downloadId && onDownloadError) {
                                            onDownloadError(downloadId, error.message || 'Erro ao baixar o arquivo');
                                          } else {
                                            alert(error.message || 'Erro ao baixar o arquivo');
                                          }
                                          setTimeout(() => {
                                            setMobileMenuOpen(null);
                                            setTimeout(() => {
                                              setJustClosedMenu(null);
                                            }, 800);
                                          }, 300);
                                        }
                                      }
                                    }}
                                    disabled={!file.canDownload || !accessToken}
                                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                  >
                                    <Download className={`w-5 h-5 ${file.canDownload && accessToken ? 'text-gray-300' : 'text-gray-500'}`} />
                                    <span className="flex-1">Baixar</span>
                                  </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                      )}

                      {/* Seletor de cores no mobile */}
                      {mobileColorPicker === file.id && (
                            <div
                              data-color-picker
                              className="fixed right-4 bottom-4 left-4 lg:absolute lg:right-0 lg:top-full lg:bottom-auto lg:left-auto lg:mt-1 bg-[#1f1f1f] border border-gray-800 rounded-lg shadow-xl p-4 z-[101] lg:hidden"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              style={{ pointerEvents: 'auto' }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm text-gray-300 font-medium">{file.type === 'folder' ? 'Escolha uma cor' : 'Escolha uma cor para o texto'}</p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (file.id) {
                                        setJustClosedPicker(file.id);
                                        setMobileColorPicker(null);
                                        setMobileMenuOpen(null);
                                        setTimeout(() => {
                                          setJustClosedPicker(null);
                                        }, 300);
                                      }
                                    }}
                                    className="p-1 hover:bg-gray-800 rounded transition-colors"
                                  >
                                    <X className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                                {((file.type === 'folder' && getFolderColor(file.id)) || (file.type !== 'folder' && getFileTextColor(file.id))) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      e.nativeEvent.stopImmediatePropagation();
                                      if (file.id) {
                                        if (file.type === 'folder') {
                                          removeFolderColor(file.id);
                                          window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color: null } }));
                                        } else {
                                          removeFileTextColor(file.id);
                                          window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color: null } }));
                                        }
                                        setColorUpdateKey((prev) => prev + 1);
                                        setJustClosedPicker(file.id);
                                        setTimeout(() => {
                                          setMobileColorPicker(null);
                                          setMobileMenuOpen(null);
                                          setTimeout(() => {
                                            setJustClosedPicker(null);
                                          }, 300);
                                        }, 200);
                                      }
                                    }}
                                    onTouchStart={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      e.nativeEvent.stopImmediatePropagation();
                                      if (file.id) {
                                        if (file.type === 'folder') {
                                          removeFolderColor(file.id);
                                          window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color: null } }));
                                        } else {
                                          removeFileTextColor(file.id);
                                          window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color: null } }));
                                        }
                                        setColorUpdateKey((prev) => prev + 1);
                                        setJustClosedPicker(file.id);
                                        setTimeout(() => {
                                          setMobileColorPicker(null);
                                          setMobileMenuOpen(null);
                                          setTimeout(() => {
                                            setJustClosedPicker(null);
                                          }, 300);
                                        }, 200);
                                      }
                                    }}
                                    className="w-full mb-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation"
                                    style={{ pointerEvents: 'auto' }}
                                  >
                                    <X className="w-4 h-4" />
                                    <span>Remover cor</span>
                                  </button>
                                )}
                                <div className="grid grid-cols-5 gap-3">
                                  {FILE_COLOR_OPTIONS.map((color) => (
                                    <button
                                      key={color}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        e.nativeEvent.stopImmediatePropagation();
                                        if (file.id) {
                                          if (file.type === 'folder') {
                                            setFolderColor(file.id, color);
                                            window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color } }));
                                          } else {
                                            setFileTextColor(file.id, color);
                                            window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color } }));
                                          }
                                          setColorUpdateKey((prev) => prev + 1);
                                          // Delay antes de fechar para evitar que o clique abra o arquivo/pasta
                                          setJustClosedPicker(file.id);
                                          setTimeout(() => {
                                            setMobileColorPicker(null);
                                            setMobileMenuOpen(null);
                                            // Mantém o card desabilitado por mais tempo para evitar clique acidental
                                            setTimeout(() => {
                                              setJustClosedPicker(null);
                                            }, 300);
                                          }, 200);
                                        }
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        e.nativeEvent.stopImmediatePropagation();
                                        if (file.id) {
                                          if (file.type === 'folder') {
                                            setFolderColor(file.id, color);
                                            window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId: file.id, color } }));
                                          } else {
                                            setFileTextColor(file.id, color);
                                            window.dispatchEvent(new CustomEvent('fileColorChanged', { detail: { fileId: file.id, color } }));
                                          }
                                          setColorUpdateKey((prev) => prev + 1);
                                          // Delay antes de fechar para evitar que o clique abra o arquivo/pasta
                                          setJustClosedPicker(file.id);
                                          setTimeout(() => {
                                            setMobileColorPicker(null);
                                            setMobileMenuOpen(null);
                                            // Mantém o card desabilitado por mais tempo para evitar clique acidental
                                            setTimeout(() => {
                                              setJustClosedPicker(null);
                                            }, 300);
                                          }, 200);
                                        }
                                      }}
                                      onTouchEnd={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        e.nativeEvent.stopImmediatePropagation();
                                      }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        e.nativeEvent.stopImmediatePropagation();
                                      }}
                                      className={`w-10 h-10 rounded-lg border-2 transition-transform active:scale-95 focus:outline-none touch-manipulation ${
                                        (file.type === 'folder' ? getFolderColor(file.id) : getFileTextColor(file.id)) === color ? 'border-white' : 'border-transparent'
                                      }`}
                                      style={{ backgroundColor: color, pointerEvents: 'auto' }}
                                      title={`Usar cor ${color}`}
                                      type="button"
                                    />
                                  ))}
                                </div>
                            </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
