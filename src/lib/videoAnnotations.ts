import { db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth } from './firebase';

// Interface para anotações de vídeo
export interface VideoAnnotation {
  id: string;
  fileId: string;
  fileName: string;
  timestamp: number; // Tempo em segundos
  comment: string; // Comentário/anotação
  createdAt: string; // Data de criação
  updatedAt: string; // Última atualização
}

// Cria uma nova anotação
export async function createAnnotation(
  fileId: string,
  fileName: string,
  timestamp: number,
  comment: string
): Promise<string | null> {
  console.log('[createAnnotation] Iniciando criação de anotação...', {
    fileId,
    fileName,
    timestamp,
    commentLength: comment.length,
  });

  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('[createAnnotation] ❌ Usuário não autenticado');
    return null;
  }

  if (!comment.trim()) {
    console.error('[createAnnotation] ❌ Comentário vazio');
    return null;
  }

  try {
    const userId = currentUser.uid;
    const annotationId = `${fileId}_${Date.now()}`; // ID único baseado em timestamp
    const docRef = doc(db, 'users', userId, 'videoAnnotations', annotationId);
    
    console.log('[createAnnotation] Dados para salvar:', {
      userId,
      annotationId,
      collection: 'users',
      subcollection: 'videoAnnotations',
      documentId: annotationId,
    });
    
    const annotationData: VideoAnnotation = {
      id: annotationId,
      fileId,
      fileName,
      timestamp,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[createAnnotation] Tentando salvar no Firestore...');
    await setDoc(docRef, annotationData);
    console.log('[createAnnotation] ✅ Anotação salva no Firestore!');
    
    // Verifica se foi salvo corretamente
    const verificationDoc = await getDoc(docRef);
    if (verificationDoc.exists()) {
      console.log('[createAnnotation] ✅ Verificação: Documento existe no Firestore');
      const savedData = verificationDoc.data();
      console.log('[createAnnotation] Dados salvos:', {
        id: savedData.id,
        fileId: savedData.fileId,
        timestamp: savedData.timestamp,
        comment: savedData.comment.substring(0, 30) + '...',
      });
    } else {
      console.error('[createAnnotation] ❌ ERRO: Documento não encontrado após salvar!');
    }
    
    return annotationId;
  } catch (error: any) {
    console.error('[createAnnotation] ❌ Erro ao criar anotação:', error);
    console.error('[createAnnotation] Tipo do erro:', error?.constructor?.name);
    console.error('[createAnnotation] Código do erro:', error?.code);
    console.error('[createAnnotation] Mensagem:', error?.message);
    
    // Se for erro de permissão, mostra instruções
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.error('[createAnnotation] ⚠️ ERRO DE PERMISSÃO!');
      console.error('[createAnnotation] Verifique se as regras do Firestore estão configuradas corretamente.');
      console.error('[createAnnotation] A regra deve permitir: users/{userId}/videoAnnotations/{annotationId}');
    }
    
    return null;
  }
}

// Busca todas as anotações de um vídeo
export async function getVideoAnnotations(fileId: string): Promise<VideoAnnotation[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return [];
  }

  try {
    const userId = currentUser.uid;
    const annotationsRef = collection(db, 'users', userId, 'videoAnnotations');
    
    // Busca todas as anotações do usuário e filtra pelo fileId (não precisa de índice)
    // Depois ordena por timestamp
    const querySnapshot = await getDocs(annotationsRef);
    const annotations: VideoAnnotation[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as VideoAnnotation;
      // Filtra apenas as anotações do arquivo específico
      if (data.fileId === fileId) {
        annotations.push(data);
      }
    });
    
    // Ordena por timestamp (crescente)
    annotations.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('[getVideoAnnotations] ✅ Anotações encontradas:', annotations.length);
    return annotations;
  } catch (error: any) {
    console.error('[getVideoAnnotations] ❌ Erro ao buscar anotações:', error);
    
    // Se o erro for sobre índice, tenta novamente sem orderBy
    if (error?.message?.includes('index')) {
      console.log('[getVideoAnnotations] Tentando buscar sem orderBy...');
      try {
        const userId = currentUser.uid;
        const annotationsRef = collection(db, 'users', userId, 'videoAnnotations');
        const querySnapshot = await getDocs(annotationsRef);
        const annotations: VideoAnnotation[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data() as VideoAnnotation;
          if (data.fileId === fileId) {
            annotations.push(data);
          }
        });
        
        annotations.sort((a, b) => a.timestamp - b.timestamp);
        console.log('[getVideoAnnotations] ✅ Anotações encontradas (sem índice):', annotations.length);
        return annotations;
      } catch (retryError) {
        console.error('[getVideoAnnotations] ❌ Erro na tentativa alternativa:', retryError);
      }
    }
    
    return [];
  }
}

// Atualiza uma anotação existente
export async function updateAnnotation(
  annotationId: string,
  comment: string
): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return false;
  }

  if (!comment.trim()) {
    return false;
  }

  try {
    const userId = currentUser.uid;
    const docRef = doc(db, 'users', userId, 'videoAnnotations', annotationId);
    
    await setDoc(docRef, {
      comment: comment.trim(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    console.log('[updateAnnotation] ✅ Anotação atualizada');
    return true;
  } catch (error: any) {
    console.error('[updateAnnotation] ❌ Erro ao atualizar anotação:', error);
    return false;
  }
}

// Remove uma anotação
export async function deleteAnnotation(annotationId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return false;
  }

  try {
    const userId = currentUser.uid;
    const docRef = doc(db, 'users', userId, 'videoAnnotations', annotationId);
    await deleteDoc(docRef);
    console.log('[deleteAnnotation] ✅ Anotação removida');
    return true;
  } catch (error: any) {
    console.error('[deleteAnnotation] ❌ Erro ao remover anotação:', error);
    return false;
  }
}

// Busca todos os IDs de arquivos que têm anotações (otimizado para lista)
export async function getFilesWithAnnotations(): Promise<Set<string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return new Set();
  }

  try {
    const userId = currentUser.uid;
    const annotationsRef = collection(db, 'users', userId, 'videoAnnotations');
    const querySnapshot = await getDocs(annotationsRef);
    const fileIds = new Set<string>();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as VideoAnnotation;
      if (data.fileId) {
        fileIds.add(data.fileId);
      }
    });
    
    console.log('[getFilesWithAnnotations] Arquivos com anotações encontrados:', fileIds.size);
    console.log('[getFilesWithAnnotations] IDs dos arquivos com anotações:', Array.from(fileIds));
    return fileIds;
  } catch (error: any) {
    console.error('[getFilesWithAnnotations] ❌ Erro ao buscar arquivos com anotações:', error);
    return new Set();
  }
}

// Busca todas as pastas que contêm vídeos com anotações
// Retorna um Set com os IDs das pastas (incluindo pastas pais)
export async function getFoldersWithAnnotatedVideos(
  accessToken: string,
  filesWithAnnotations: Set<string>
): Promise<Set<string>> {
  if (filesWithAnnotations.size === 0) {
    return new Set();
  }

  const folderIds = new Set<string>();

  try {
    // Para cada vídeo com anotação, busca suas pastas pais
    const promises = Array.from(filesWithAnnotations).map(async (fileId) => {
      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents&supportsAllDrives=true&includeItemsFromAllDrives=true`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (response.ok) {
          const fileData = await response.json();
          // Adiciona todas as pastas pais (e recursivamente suas pais também)
          if (fileData.parents && Array.isArray(fileData.parents)) {
            // Aguarda todas as chamadas recursivas completarem
            await Promise.all(fileData.parents.map(async (parentId: string) => {
              folderIds.add(parentId);
              // Busca recursivamente os pais das pastas
              await fetchParentsRecursively(parentId, accessToken, folderIds);
            }));
          }
        }
      } catch (error) {
        console.error(`[getFoldersWithAnnotatedVideos] Erro ao buscar pais de ${fileId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('[getFoldersWithAnnotatedVideos] Pastas com vídeos anotados encontradas:', folderIds.size);
    return folderIds;
  } catch (error: any) {
    console.error('[getFoldersWithAnnotatedVideos] ❌ Erro ao buscar pastas com anotações:', error);
    return new Set();
  }
}

// Função auxiliar recursiva para buscar todos os pais de uma pasta
async function fetchParentsRecursively(
  folderId: string,
  accessToken: string,
  folderIds: Set<string>,
  visited = new Set<string>()
): Promise<void> {
  if (visited.has(folderId)) {
    return; // Evita loops infinitos
  }
  visited.add(folderId);

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=parents&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      const folderData = await response.json();
      if (folderData.parents && Array.isArray(folderData.parents)) {
        // Aguarda todas as chamadas recursivas completarem
        await Promise.all(folderData.parents.map(async (parentId: string) => {
          folderIds.add(parentId);
          // Continua recursivamente para os pais
          await fetchParentsRecursively(parentId, accessToken, folderIds, visited);
        }));
      }
    }
  } catch (error) {
    console.error(`[fetchParentsRecursively] Erro ao buscar pais recursivo de ${folderId}:`, error);
  }
}

// Formata tempo em formato legível
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

