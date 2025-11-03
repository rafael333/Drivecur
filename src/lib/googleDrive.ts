// Helper para renovação automática de tokens
import { fetchWithAutoRefresh } from './googleAuthHelper';

// Tipos para a API do Google Drive
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime: string;
  viewedByMeTime?: string;
  size?: string;
  description?: string;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  }>;
  lastModifyingUser?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  };
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  thumbnailVersion?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
    rotation?: number;
  };
  videoMediaMetadata?: {
    width?: number;
    height?: number;
    durationMillis?: string;
  };
  capabilities?: {
    canDownload?: boolean;
    canCopy?: boolean;
    canEdit?: boolean;
    canShare?: boolean;
    canDelete?: boolean;
  };
  permissions?: Array<{
    id?: string;
    type?: string;
    role?: string;
    displayName?: string;
    emailAddress?: string;
  }>;
  shared?: boolean;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
}

// Mapeia MIME types para extensões de arquivo
const mimeTypeToExtension = (mimeType: string, fileName: string): string => {
  // Primeiro tenta extrair do nome do arquivo
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot !== -1 && lastDot < fileName.length - 1) {
    const extFromName = fileName.substring(lastDot + 1).toLowerCase();
    // Retorna a extensão do nome se existir
    return `.${extFromName}`;
  }

  // Se não tiver no nome, mapeia pelo mimeType
  const mimeToExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.ms-excel': '.xls',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z',
    // Vídeos
    'video/mp4': '.mp4',
    'video/x-msvideo': '.avi',
    'video/quicktime': '.mov',
    'video/x-ms-wmv': '.wmv',
    'video/webm': '.webm',
    'video/x-matroska': '.mkv',
    'video/mpeg': '.mpeg',
    'video/x-flv': '.flv',
    // Áudios
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
    // Textos
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html',
    'application/json': '.json',
    'application/xml': '.xml',
  };

  // Para vídeos genéricos sem tipo específico
  if (mimeType.startsWith('video/')) {
    const videoExt = mimeToExt[mimeType];
    return videoExt || '.mp4'; // Default para vídeos
  }

  return mimeToExt[mimeType] || '';
};

// Mapeia MIME types do Google Drive para tipos do nosso app
const mimeTypeToFileType = (mimeType: string): 'pdf' | 'pptx' | 'xlsx' | 'docx' | 'folder' | 'png' | 'jpg' | 'zip' | 'video' => {
  // Primeiro verifica se é pasta - IMPORTANTE: deve ser a primeira verificação
  if (!mimeType || mimeType === 'application/vnd.google-apps.folder' || mimeType.includes('folder')) {
    return 'folder';
  }
  
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'zip';
  
  // Para vídeos, retorna 'video'
  if (mimeType.startsWith('video/')) return 'video';
  return 'pdf'; // default
};

// Formata tamanho do arquivo
const formatFileSize = (bytes?: string): string => {
  if (!bytes) return '-';
  const size = parseInt(bytes, 10);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Formata data (formato curto)
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Formata data e hora completa
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Formata duração de vídeo
const formatVideoDuration = (millis?: string): string => {
  if (!millis) return '';
  const totalSeconds = Math.floor(parseInt(millis, 10) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Verifica se uma pasta é compartilhada (não pertence ao usuário atual)
export async function isSharedFolder(
  accessToken: string,
  folderId: string
): Promise<boolean> {
  try {
    // Busca informações da pasta com parâmetros corretos para pastas compartilhadas
    // Usa 'me' na query para verificar se o usuário é owner
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,owners,shared,capabilities&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      // Se não conseguir acessar com os parâmetros básicos, tenta com parâmetros de pastas compartilhadas
      // Se conseguir com esses parâmetros, provavelmente é compartilhada
      console.warn('Não conseguiu acessar pasta com parâmetros básicos, assumindo compartilhada');
      return true;
    }
    
    const data = await response.json();
    
    // Método 1: Verifica se está marcada como compartilhada
    if (data.shared === true) {
      return true;
    }
    
    // Método 2: Verifica se o usuário tem capacidade de owner
    // Se não pode deletar/compartilhar (mas conseguiu acessar), provavelmente não é owner
    if (data.capabilities) {
      const canDelete = data.capabilities.canDelete;
      const canShare = data.capabilities.canShare;
      
      // Se conseguiu acessar mas não pode deletar/compartilhar, provavelmente não é owner
      if (canDelete === false || canShare === false) {
        return true;
      }
    }
    
    // Método 3: Tenta buscar a pasta com query que filtra por ownership
    // Se não encontrar com filtro de owner, provavelmente não é do usuário
    const testQuery = `'${folderId}' in parents and 'me' in owners and trashed=false`;
    const testResponse = await fetchWithAutoRefresh(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(testQuery)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      () => accessToken
    );
    
    if (testResponse.ok) {
      const testData = await testResponse.json();
      // Se não encontrar arquivos com filtro de owner, provavelmente a pasta não é do usuário
      // Mas isso não é definitivo, então vamos usar uma abordagem mais segura
    }
    
    // Por padrão, assume que não é compartilhada se conseguir acessar normalmente
    // Mas se a pasta veio de "Compartilhados comigo" ou foi adicionada como link, pode ser compartilhada
    return false;
  } catch (err) {
    // Em caso de erro, tenta uma abordagem mais conservadora
    // Se conseguiu acessar a pasta mas ocorreu erro na verificação, assume que não é compartilhada
    console.warn('Erro ao verificar se pasta é compartilhada:', err);
    return false;
  }
}

// Busca arquivos do Google Drive
export async function listDriveFiles(
  accessToken: string,
  searchQuery?: string,
  pageToken?: string,
  parentFolderId?: string,
  sharedWithMe?: boolean,
  isSharedFolderId?: boolean
): Promise<{ files: any[]; nextPageToken?: string }> {
  let query = 'trashed=false';
  
  // Se estiver dentro de uma pasta compartilhada (mesmo em "Meu Drive")
  if (isSharedFolderId && parentFolderId) {
    // Para pastas compartilhadas, busca apenas por parent - SEM filtro de owner
    // Isso permite ver todos os arquivos dentro da pasta compartilhada
    query = `'${parentFolderId}' in parents and trashed=false`;
    
    // Adiciona busca se houver
    if (searchQuery && searchQuery.trim()) {
      const escapedQuery = searchQuery.trim().replace(/'/g, "\\'");
      query += ` and (name contains '${escapedQuery}' or fullText contains '${escapedQuery}')`;
    }
    
  }
  // Se for arquivos compartilhados OU se estiver dentro de uma pasta compartilhada
  else if (sharedWithMe || isSharedFolderId) {
    // Se estiver dentro de uma pasta compartilhada específica, não filtra por owner
    // Isso permite buscar arquivos de pastas compartilhadas
    
    if (searchQuery && searchQuery.trim()) {
      const escapedQuery = searchQuery.trim().replace(/'/g, "\\'");
      query += ` and (name contains '${escapedQuery}' or fullText contains '${escapedQuery}')`;
    }
    
    // Se estiver dentro de uma pasta compartilhada, busca apenas por parent (sem filtro de owner)
    if (parentFolderId && isSharedFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    } else if (parentFolderId && sharedWithMe) {
      // Se estiver no modo "Compartilhados comigo" dentro de uma pasta, busca por parent
      query += ` and '${parentFolderId}' in parents`;
    } else if (sharedWithMe && !parentFolderId) {
      // Se for modo "Compartilhados comigo" na raiz, busca arquivos compartilhados
      // Inclui arquivos compartilhados por link público E por email
      // Exclui apenas arquivos próprios
      query += ` and not 'me' in owners`;
      // Nota: A API do Google Drive já retorna arquivos compartilhados por qualquer método
      // quando usamos 'not me in owners' com os parâmetros includeItemsFromAllDrives
    }
  } else {
    // Para "Meu Drive", busca APENAS arquivos onde o usuário é proprietário
    // Garante que apenas arquivos próprios sejam exibidos
    query += ` and 'me' in owners`;
    
    // Se houver busca, não filtra por pasta (busca em todo o Drive)
    if (searchQuery && searchQuery.trim()) {
      const escapedQuery = searchQuery.trim().replace(/'/g, "\\'");
      query += ` and (name contains '${escapedQuery}' or fullText contains '${escapedQuery}')`;
    } else {
      // Se não houver busca, filtra por pasta
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents and 'me' in owners`;
      } else {
        // Se não estiver em uma pasta, busca apenas arquivos na raiz que são próprios
        query += ` and parents in 'root'`;
      }
    }
  }

  const fields = 'nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, viewedByMeTime, size, description, owners, lastModifyingUser, webViewLink, webContentLink, thumbnailLink, thumbnailVersion, imageMediaMetadata, videoMediaMetadata, capabilities, permissions, shared, starred, trashed, parents)';
  const params = new URLSearchParams({
    q: query,
    fields,
    orderBy: 'modifiedTime desc',
    pageSize: '50',
  });

  // IMPORTANTE: Para "Meu Drive" (não compartilhado), NÃO adiciona parâmetros de drives compartilhados
  // Isso garante que apenas arquivos próprios sejam exibidos
  // Para arquivos compartilhados ou pastas compartilhadas, adiciona parâmetros específicos
  // Esses parâmetros são OBRIGATÓRIOS para acessar pastas/arquivos compartilhados
  if (sharedWithMe || isSharedFolderId) {
    params.append('includeItemsFromAllDrives', 'true');
    params.append('supportsAllDrives', 'true');
    
    // Para o modo "Compartilhados comigo" na raiz, usa 'allDrives' para buscar TODOS os arquivos compartilhados
    // Isso inclui arquivos compartilhados por link público E por email
    if (sharedWithMe && !parentFolderId) {
      params.append('corpora', 'allDrives');
      // IMPORTANTE: 'allDrives' busca em todos os drives acessíveis, incluindo:
      // - Arquivos compartilhados diretamente por email
      // - Arquivos compartilhados por link público (quando o usuário tem acesso)
      // - Arquivos em drives compartilhados
    }
  }
  
  // IMPORTANTE: Se estiver dentro de uma pasta compartilhada, SEMPRE precisa desses parâmetros
  // Mesmo que não esteja no modo "shared-with-me"
  if (isSharedFolderId && parentFolderId) {
    params.append('includeItemsFromAllDrives', 'true');
    params.append('supportsAllDrives', 'true');
  }

  if (pageToken) {
    params.append('pageToken', pageToken);
  }

  // Usa helper para renovação automática de token
  const response = await fetchWithAutoRefresh(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    () => accessToken
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Erro desconhecido' } }));
    
    // Se for erro de autenticação, fornece mensagem mais clara
    if (response.status === 401) {
      throw new Error('Token de autenticação inválido ou expirado. Por favor, faça login novamente.');
    }
    
    throw new Error(errorData.error?.message || 'Erro ao buscar arquivos do Google Drive');
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

// Converte arquivo do Google Drive para FileItem
export function convertDriveFileToFileItem(driveFile: GoogleDriveFile): any {
  const owner = driveFile.owners?.[0];
  const ownerName = owner?.displayName || 'Usuário';
  const ownerEmail = owner?.emailAddress || '';
  const ownerPhoto = owner?.photoLink;

  const lastModifier = driveFile.lastModifyingUser;
  const lastModifiedByName = lastModifier?.displayName || '';
  const lastModifiedByEmail = lastModifier?.emailAddress || '';
  const lastModifiedByPhoto = lastModifier?.photoLink;

  // Verifica explicitamente se é uma pasta ANTES de mapear o tipo
  const isFolder = driveFile.mimeType === 'application/vnd.google-apps.folder' || 
                   !driveFile.mimeType || 
                   driveFile.mimeType.includes('folder');

  // Obtém a extensão do arquivo
  const extension = isFolder ? '' : mimeTypeToExtension(driveFile.mimeType || '', driveFile.name || '');
  
  // Remove a extensão do nome se ela já estiver presente para não duplicar
  let displayName = driveFile.name || '';
  if (!isFolder && extension && displayName.toLowerCase().endsWith(extension.toLowerCase())) {
    // Remove a extensão do nome para mostrar separadamente
    displayName = displayName.slice(0, -extension.length);
  }

  // Calcula tamanho em bytes
  const sizeBytes = driveFile.size ? parseInt(driveFile.size, 10) : undefined;

  return {
    id: driveFile.id,
    name: displayName,
    originalName: driveFile.name, // Mantém o nome original completo
    extension: extension,
    type: isFolder ? 'folder' : mimeTypeToFileType(driveFile.mimeType || ''),
    owner: ownerName,
    ownerEmail,
    ownerPhoto,
    lastModifiedBy: lastModifiedByName || ownerName,
    lastModifiedByEmail: lastModifiedByEmail || ownerEmail,
    lastModifiedByPhoto,
    createdDate: driveFile.createdTime ? formatDate(driveFile.createdTime) : formatDate(driveFile.modifiedTime),
    createdTime: driveFile.createdTime || driveFile.modifiedTime,
    modifiedDate: formatDate(driveFile.modifiedTime),
    modifiedTime: formatDateTime(driveFile.modifiedTime),
    viewedByMeTime: driveFile.viewedByMeTime ? formatDateTime(driveFile.viewedByMeTime) : undefined,
    size: isFolder ? '-' : formatFileSize(driveFile.size), // Pastas não têm tamanho
    sizeBytes,
    description: driveFile.description || '',
    webViewLink: driveFile.webViewLink,
    webContentLink: driveFile.webContentLink, // Link direto para download
    thumbnailLink: driveFile.thumbnailLink,
    shared: driveFile.shared || false,
    starred: driveFile.starred || false,
    canDownload: driveFile.capabilities?.canDownload ?? true,
    canCopy: driveFile.capabilities?.canCopy ?? false,
    canEdit: driveFile.capabilities?.canEdit ?? false,
    canShare: driveFile.capabilities?.canShare ?? false,
    canDelete: driveFile.capabilities?.canDelete ?? false,
    imageWidth: driveFile.imageMediaMetadata?.width,
    imageHeight: driveFile.imageMediaMetadata?.height,
    videoWidth: driveFile.videoMediaMetadata?.width,
    videoHeight: driveFile.videoMediaMetadata?.height,
    videoDuration: driveFile.videoMediaMetadata?.durationMillis 
      ? formatVideoDuration(driveFile.videoMediaMetadata.durationMillis) 
      : undefined,
    permissionCount: driveFile.permissions?.length || 0,
    mimeType: driveFile.mimeType,
  };
}

/**
 * Callback para atualizar o progresso do download
 */
export type DownloadProgressCallback = (progress: number) => void;

/**
 * Lista todos os arquivos de uma pasta recursivamente
 */
async function listAllFilesInFolder(
  accessToken: string,
  folderId: string,
  folderPath: string = '',
  isSharedFolder?: boolean
): Promise<Array<{ file: any; path: string }>> {
  const allFiles: Array<{ file: any; path: string }> = [];
  
  async function listRecursive(parentId: string, currentPath: string, parentIsShared?: boolean): Promise<void> {
    let pageToken: string | undefined;
    
    // Determina se a pasta atual é compartilhada
    // Usa a informação do pai para evitar verificações desnecessárias
    let currentIsShared = parentIsShared !== undefined ? parentIsShared : (isSharedFolder || false);
    
    // Só verifica se não souber o status da pasta pai e se for a primeira vez
    if (!currentIsShared && parentIsShared === undefined && isSharedFolder === undefined) {
      // Verifica apenas uma vez por pasta para evitar múltiplas requisições
      try {
        currentIsShared = await isSharedFolder(accessToken, parentId);
      } catch (error) {
        console.warn('Erro ao verificar se pasta é compartilhada, usando parâmetros de pasta compartilhada:', error);
        currentIsShared = true; // Em caso de erro, tenta com parâmetros de pasta compartilhada
      }
    }
    
    do {
      try {
        // Lista os arquivos com base no status conhecido da pasta
        // Se não souber, tenta primeiro sem filtro (mais compatível)
        const result = await listDriveFiles(
          accessToken,
          undefined,
          pageToken,
          parentId,
          false,
          currentIsShared
        );
        
        for (const driveFile of result.files) {
          const fileName = driveFile.name || 'unnamed';
          const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
          
          if (driveFile.mimeType === 'application/vnd.google-apps.folder') {
            // É uma pasta, recursivamente lista seu conteúdo
            await listRecursive(driveFile.id, filePath, currentIsShared);
          } else {
            // É um arquivo, adiciona à lista
            allFiles.push({ file: driveFile, path: filePath });
          }
        }
        
        pageToken = result.nextPageToken;
      } catch (error: any) {
        console.error('Erro ao listar arquivos da pasta:', error);
        throw error;
      }
    } while (pageToken);
  }
  
  await listRecursive(folderId, folderPath);
  return allFiles;
}

/**
 * Baixa uma pasta inteira recursivamente
 */
export async function downloadFolder(
  folderId: string,
  folderName: string,
  accessToken: string,
  onProgress?: DownloadProgressCallback,
  onFileStart?: (fileName: string) => string,
  onFileProgress?: (id: string, progress: number) => void,
  onFileComplete?: (id: string) => void,
  onFileError?: (id: string, error: string) => void
): Promise<void> {
  try {
    console.log('[downloadFolder] Iniciando download da pasta:', folderName, folderId);
    
    // Atualiza progresso para mostrar que está listando arquivos
    if (onProgress) {
      onProgress(0);
    }
    
    // Verifica se a pasta é compartilhada
    console.log('[downloadFolder] Verificando se pasta é compartilhada...');
    const isShared = await isSharedFolder(accessToken, folderId).catch(() => {
      console.warn('[downloadFolder] Erro ao verificar se pasta é compartilhada, assumindo não compartilhada');
      return false;
    });
    
    // Lista todos os arquivos da pasta recursivamente
    console.log('[downloadFolder] Listando arquivos da pasta...');
    const allFiles = await listAllFilesInFolder(accessToken, folderId, folderName, isShared);
    
    console.log('[downloadFolder] Arquivos encontrados:', allFiles.length);
    
    if (allFiles.length === 0) {
      console.warn('[downloadFolder] Pasta vazia');
      alert('A pasta está vazia.');
      return;
    }
    
    const totalFiles = allFiles.length;
    let completedFiles = 0;
    const maxConcurrent = 5; // Limita downloads paralelos para não sobrecarregar
    
    console.log('[downloadFolder] Iniciando download de', totalFiles, 'arquivos em lotes de', maxConcurrent);
    
    // Função para baixar um arquivo individual
    const downloadSingleFile = async ({ file, path }: { file: any; path: string }): Promise<void> => {
      const fullPath = path;
      const downloadId = onFileStart ? onFileStart(fullPath) : null;
      
      try {
        // Extrai o nome do arquivo do caminho completo
        const fileName = path.split('/').pop() || file.name;
        const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
        const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
        
        console.log('[downloadFolder] Baixando arquivo:', baseName + extension, 'ID:', file.id);
        
        // Verifica se pode baixar
        if (file.capabilities?.canDownload === false) {
          console.warn('[downloadFolder] Arquivo sem permissão de download:', baseName + extension);
          throw new Error(`Sem permissão para baixar: ${baseName + extension}`);
        }
        
        await downloadFile(
          {
            id: file.id,
            name: baseName,
            originalName: baseName,
            extension: extension,
            mimeType: file.mimeType,
            canDownload: file.capabilities?.canDownload !== false,
          },
          accessToken,
          (progress) => {
            // Calcula progresso global considerando múltiplos arquivos
            const fileProgress = progress / totalFiles;
            const currentCompleted = completedFiles;
            const globalProgress = (currentCompleted / totalFiles) * 100 + fileProgress;
            
            if (onProgress) {
              onProgress(Math.min(100, Math.max(0, globalProgress)));
            }
            
            if (downloadId && onFileProgress) {
              onFileProgress(downloadId, progress);
            }
          }
        );
        
        completedFiles++;
        console.log('[downloadFolder] Arquivo concluído:', baseName + extension, `(${completedFiles}/${totalFiles})`);
        
        if (downloadId && onFileComplete) {
          onFileComplete(downloadId);
        }
      } catch (error: any) {
        completedFiles++; // Incrementa mesmo em caso de erro para não travar
        console.error(`[downloadFolder] Erro ao baixar ${path}:`, error);
        if (downloadId && onFileError) {
          onFileError(downloadId, error.message || 'Erro ao baixar arquivo');
        }
        // Continua baixando outros arquivos mesmo se um falhar
      }
    };
    
    // Baixa arquivos em lotes paralelos para acelerar
    console.log('[downloadFolder] Começando downloads paralelos...');
    console.log('[downloadFolder] Total de arquivos:', totalFiles, 'Max concorrente:', maxConcurrent);
    
    for (let i = 0; i < allFiles.length; i += maxConcurrent) {
      const batch = allFiles.slice(i, i + maxConcurrent);
      const batchNumber = Math.floor(i / maxConcurrent) + 1;
      const totalBatches = Math.ceil(allFiles.length / maxConcurrent);
      console.log(`[downloadFolder] Baixando lote ${batchNumber}/${totalBatches} (${batch.length} arquivos)...`);
      
      try {
        await Promise.all(batch.map((fileData) => {
          console.log('[downloadFolder] Iniciando download no lote:', fileData.path);
          return downloadSingleFile(fileData);
        }));
        
        console.log(`[downloadFolder] Lote ${batchNumber} concluído. Progresso: ${completedFiles}/${totalFiles}`);
      } catch (batchError) {
        console.error(`[downloadFolder] Erro no lote ${batchNumber}:`, batchError);
        // Continua com próximo lote mesmo se um lote falhar
      }
    }
    
    console.log('[downloadFolder] Todos os downloads concluídos!');
    if (onProgress) {
      onProgress(100);
    }
  } catch (error: any) {
    console.error('[downloadFolder] Erro geral:', error);
    throw new Error(`Erro ao baixar pasta: ${error.message}`);
  }
}

/**
 * Função auxiliar para baixar com rastreamento de progresso usando XMLHttpRequest
 */
async function downloadWithProgress(
  url: string,
  accessToken: string,
  file: {
    id: string;
    name?: string;
    originalName?: string;
    extension?: string;
    mimeType?: string;
  },
  onProgress?: DownloadProgressCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.responseType = 'blob';
    
    // Timeout de 10 minutos para arquivos grandes
    xhr.timeout = 600000; // 10 minutos
    
    // Throttle para atualização de progresso (evita overhead em arquivos grandes)
    let lastUpdate = 0;
    const throttleMs = 100; // Atualiza no máximo a cada 100ms
    
    // Rastreia o progresso do download com throttle
    xhr.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const now = Date.now();
        // Atualiza apenas se passou o tempo de throttle ou se for o último update (100%)
        if (now - lastUpdate >= throttleMs || event.loaded === event.total) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(Math.min(100, Math.max(0, percentComplete)));
          lastUpdate = now;
        }
      }
    });
    
    xhr.addEventListener('timeout', () => {
      reject(new Error('Timeout: Download demorou muito tempo. Tente novamente.'));
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Adiciona extensão apropriada para Google Docs
        let extension = file.extension || '';
        if (!extension && file.mimeType) {
          if (file.mimeType === 'application/vnd.google-apps.document') extension = '.docx';
          else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') extension = '.xlsx';
          else if (file.mimeType === 'application/vnd.google-apps.presentation') extension = '.pptx';
        }
        
        a.download = `${file.originalName || file.name || 'download'}${extension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        if (onProgress) {
          onProgress(100);
        }
        
        resolve();
      } else {
        let errorMessage = 'Erro ao baixar o arquivo.';
        if (xhr.status === 401) {
          errorMessage = 'Sessão expirada. Faça login novamente.';
        } else if (xhr.status === 403) {
          errorMessage = 'Sem permissão para baixar este arquivo.';
        }
        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Erro de rede ao baixar o arquivo.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Download cancelado.'));
    });

    xhr.send();
  });
}

/**
 * Função utilitária para baixar arquivos do Google Drive
 * Suporta arquivos normais e Google Docs (exportação)
 * @param onProgress Callback opcional para receber atualizações de progresso (0-100)
 */
export async function downloadFile(
  file: {
    id: string;
    name?: string;
    originalName?: string;
    extension?: string;
    webContentLink?: string;
    webViewLink?: string;
    mimeType?: string;
    canDownload?: boolean;
  },
  accessToken: string,
  onProgress?: DownloadProgressCallback
): Promise<void> {
  if (!file.canDownload) {
    alert('Você não tem permissão para baixar este arquivo.');
    return;
  }

  try {
    // Sempre usa a API do Google Drive para baixar diretamente (não abre abas)
    if (accessToken && file.id) {
      // Para Google Docs, Sheets, Slides, etc., precisa exportar
      const isGoogleDoc = file.mimeType?.includes('application/vnd.google-apps');

      if (isGoogleDoc) {
        // Exporta Google Docs para formato apropriado
        const exportMimeType = file.mimeType === 'application/vnd.google-apps.document'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : file.mimeType === 'application/vnd.google-apps.spreadsheet'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : file.mimeType === 'application/vnd.google-apps.presentation'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/pdf';

        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportMimeType)}`;

        // Usa XMLHttpRequest para rastrear progresso
        await downloadWithProgress(
          downloadUrl,
          accessToken,
          file,
          onProgress
        );
      } else {
        // Para outros arquivos, usa o endpoint de download direto
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;

        await downloadWithProgress(
          downloadUrl,
          accessToken,
          file,
          onProgress
        );
      }
    } else {
      // Se não tiver accessToken, não pode baixar
      alert('Token de acesso necessário para baixar o arquivo. Faça login novamente.');
    }
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
    alert('Erro ao baixar o arquivo. Tente novamente.');
  }
}

