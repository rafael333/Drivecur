import { db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth } from './firebase';

// Interface para o progresso do vídeo salvo
interface VideoProgress {
  fileId: string;
  fileName: string;
  currentTime: number; // Tempo atual em segundos
  duration?: number; // Duração total do vídeo (opcional)
  watchedAt: string; // Data/hora de quando assistiu
  lastUpdated: string; // Última atualização
}

// Salva a posição atual do vídeo no Firestore
export async function saveVideoProgress(
  fileId: string,
  fileName: string,
  currentTime: number,
  duration?: number
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('[saveVideoProgress] Usuário não autenticado, não é possível salvar progresso');
    return;
  }

  // Não salva se estiver no início (menos de 5 segundos) ou muito perto do fim (95%+)
  if (currentTime < 5) {
    console.log('[saveVideoProgress] Vídeo no início, não salvando progresso');
    return;
  }

  if (duration && currentTime >= duration * 0.95) {
    console.log('[saveVideoProgress] Vídeo quase no fim, não salvando progresso');
    // Se estiver no fim, remove o progresso salvo (vídeo assistido completamente)
    await deleteVideoProgress(fileId);
    return;
  }

  try {
    const userId = currentUser.uid;
    const docRef = doc(db, 'users', userId, 'videoProgress', fileId);
    
    const progressData: VideoProgress = {
      fileId,
      fileName,
      currentTime,
      duration,
      watchedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    await setDoc(docRef, progressData, { merge: true });
    console.log('[saveVideoProgress] ✅ Progresso salvo:', {
      fileId,
      fileName,
      currentTime: formatTime(currentTime),
      duration: duration ? formatTime(duration) : 'N/A',
    });
  } catch (error: any) {
    console.error('[saveVideoProgress] ❌ Erro ao salvar progresso:', error);
  }
}

// Busca a posição salva do vídeo
export async function getVideoProgress(fileId: string): Promise<number | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    const userId = currentUser.uid;
    const docRef = doc(db, 'users', userId, 'videoProgress', fileId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as VideoProgress;
      console.log('[getVideoProgress] ✅ Progresso encontrado:', {
        fileId,
        fileName: data.fileName,
        currentTime: formatTime(data.currentTime),
        lastUpdated: data.lastUpdated,
      });
      return data.currentTime;
    } else {
      console.log('[getVideoProgress] Nenhum progresso encontrado para:', fileId);
    }
  } catch (error: any) {
    console.error('[getVideoProgress] ❌ Erro ao buscar progresso:', error);
  }
  
  return null;
}

// Remove o progresso salvo do vídeo
export async function deleteVideoProgress(fileId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return;
  }

  try {
    const userId = currentUser.uid;
    const docRef = doc(db, 'users', userId, 'videoProgress', fileId);
    await deleteDoc(docRef);
    console.log('[deleteVideoProgress] Progresso removido para:', fileId);
  } catch (error: any) {
    console.error('[deleteVideoProgress] Erro ao remover progresso:', error);
  }
}

// Formata tempo em formato legível (minutos:segundos)
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}










