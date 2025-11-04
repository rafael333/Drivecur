import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Gauge, MessageSquare, X, Edit2, Trash2 } from 'lucide-react';
import { FileItem } from '../types';
import { saveVideoProgress, getVideoProgress } from '../lib/videoProgress';
import { createAnnotation, getVideoAnnotations, updateAnnotation, deleteAnnotation, VideoAnnotation } from '../lib/videoAnnotations';

interface VideoPlayerProps {
  file: FileItem;
  accessToken: string;
}

// Opções de velocidade de reprodução
const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function VideoPlayer({ file, accessToken }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const blobUrlRef = useRef<string | null>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  
  // Estados para anotações
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<VideoAnnotation[]>([]);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [annotationComment, setAnnotationComment] = useState('');
  const [editingAnnotation, setEditingAnnotation] = useState<VideoAnnotation | null>(null);
  const annotationFormRef = useRef<HTMLDivElement>(null);

  // Detecta se é dispositivo mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

  // Carrega o vídeo e restaura a posição salva
  useEffect(() => {
    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Limpa blob URL anterior se existir
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        console.log('[VideoPlayer] Carregando vídeo:', file.name, file.id);
        console.log('[VideoPlayer] É mobile:', isMobile);
        
        if (!file.id) {
          throw new Error('ID do arquivo não encontrado');
        }
        
        if (!accessToken) {
          throw new Error('Token de acesso não encontrado');
        }
        
        const apiUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
        
        // Usa fetch + blob URL tanto em mobile quanto desktop
        // A URL direta com token não funciona em mobile, então sempre usa blob URL
        console.log('[VideoPlayer] Fazendo requisição para:', apiUrl);
        console.log('[VideoPlayer] É mobile:', isMobile);
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        console.log('[VideoPlayer] Resposta recebida, status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Erro desconhecido');
          console.error('[VideoPlayer] ❌ Erro na resposta:', errorText);
          throw new Error(`Erro ao carregar vídeo: ${response.status} - ${response.statusText}. ${errorText}`);
        }

        // Verifica o tipo de conteúdo
        const contentType = response.headers.get('content-type');
        console.log('[VideoPlayer] Content-Type:', contentType);
        
        if (!contentType || !contentType.startsWith('video/')) {
          console.warn('[VideoPlayer] ⚠️ Content-Type não é vídeo:', contentType);
        }

        // Cria blob URL
        // Nota: await response.blob() baixa o arquivo inteiro na memória
        // Infelizmente, isso é necessário porque a URL direta não funciona em mobile
        console.log('[VideoPlayer] Criando blob...');
        const blob = await response.blob();
        console.log('[VideoPlayer] ✅ Blob criado, tamanho:', blob.size, 'bytes', `(${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        
        if (blob.size === 0) {
          throw new Error('Vídeo vazio ou erro ao baixar');
        }
        
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        
        console.log('[VideoPlayer] ✅ Blob URL criada:', blobUrl);
        setVideoUrl(blobUrl);
        
        // Não marca como carregado ainda - deixa o vídeo começar a bufferar
        // O handleCanPlay vai marcar como carregado quando estiver pronto
      } catch (err: any) {
        console.error('[VideoPlayer] ❌ Erro geral ao carregar vídeo:', err);
        setError(err.message || 'Erro ao carregar vídeo. Verifique sua conexão e permissões.');
        setIsLoading(false);
      }
    };

    loadVideo();
    
    // Limpa blob URL quando o componente for desmontado
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [file.id, accessToken, file.name, isMobile]);

  // Configura atributos mobile no elemento de vídeo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isMobile) {
      // Atributos para compatibilidade mobile (especialmente iOS)
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('x-webkit-airplay', 'allow');
    }
  }, [isMobile, videoUrl]);

  // Carrega as anotações assim que o componente monta (não depende do vídeo estar pronto)
  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        console.log('[VideoPlayer] Carregando anotações para:', file.id);
        const loadedAnnotations = await getVideoAnnotations(file.id);
        console.log('[VideoPlayer] ✅ Anotações carregadas:', loadedAnnotations.length);
        setAnnotations(loadedAnnotations);
      } catch (error) {
        console.error('[VideoPlayer] Erro ao carregar anotações:', error);
        setAnnotations([]);
      }
    };

    loadAnnotations();
  }, [file.id]);

  // Carrega a posição salva do vídeo quando os metadados estiverem prontos
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const loadSavedData = async () => {
      try {
        // Carrega posição salva
        const savedTime = await getVideoProgress(file.id);
        
        if (savedTime && savedTime > 5) {
          // Aguarda os metadados estarem carregados antes de definir a posição
          if (video.readyState >= 1) {
            video.currentTime = savedTime;
            setCurrentTime(savedTime);
            console.log('[VideoPlayer] ✅ Posição restaurada:', savedTime, 'segundos');
          } else {
            // Se os metadados ainda não estiverem prontos, aguarda
            const handleLoadedMetadata = () => {
              video.currentTime = savedTime;
              setCurrentTime(savedTime);
              console.log('[VideoPlayer] ✅ Posição restaurada após carregar metadados:', savedTime, 'segundos');
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            };
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
          }
        }
      } catch (error) {
        console.error('[VideoPlayer] Erro ao carregar dados salvos:', error);
      }
    };

    loadSavedData();
  }, [videoUrl, file.id]);

  // Atualiza o tempo atual do vídeo e salva progresso periodicamente
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Define a velocidade de reprodução inicial (tenta aplicar quando o vídeo estiver pronto)
    const applyInitialPlaybackRate = () => {
      if (video.readyState >= 1) {
        video.playbackRate = playbackRate;
        console.log('[VideoPlayer] Velocidade inicial aplicada:', playbackRate, 'x');
      }
    };
    
    // Tenta aplicar imediatamente
    applyInitialPlaybackRate();
    
    // Também aplica quando os metadados estiverem carregados
    const handleMetadataLoaded = () => {
      applyInitialPlaybackRate();
    };
    
    video.addEventListener('loadedmetadata', handleMetadataLoaded);

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => {
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
    };
    const handleCanPlay = () => {
      setIsLoading(false);
      // Quando o vídeo pode tocar, já tem buffer suficiente para começar
      console.log('[VideoPlayer] Vídeo pode tocar - buffer pronto');
    };
    
    const handleCanPlayThrough = () => {
      // Quando há buffer suficiente para tocar sem pausar
      setIsLoading(false);
      console.log('[VideoPlayer] Vídeo tem buffer suficiente para reprodução contínua');
    };
    
    const handleWaiting = () => {
      // Quando está esperando por mais dados
      setIsLoading(true);
      console.log('[VideoPlayer] Vídeo aguardando buffer...');
    };
    
    const handleLoadedData = () => {
      // Quando os primeiros dados foram carregados
      console.log('[VideoPlayer] Primeiros dados do vídeo carregados');
    };

    // Salva o progresso a cada 10 segundos (evita muitas chamadas ao Firestore)
    let saveProgressInterval: NodeJS.Timeout | null = null;
    const startSavingProgress = () => {
      if (saveProgressInterval) clearInterval(saveProgressInterval);
      saveProgressInterval = setInterval(() => {
        if (video.currentTime && video.duration) {
          saveVideoProgress(file.id, file.name, video.currentTime, video.duration);
        }
      }, 10000); // Salva a cada 10 segundos
    };

    // Salva quando pausar
    const handlePause = () => {
      if (video.currentTime && video.duration) {
        saveVideoProgress(file.id, file.name, video.currentTime, video.duration);
      }
      if (saveProgressInterval) {
        clearInterval(saveProgressInterval);
        saveProgressInterval = null;
      }
    };

    // Salva quando começar a tocar
    const handlePlay = () => {
      startSavingProgress();
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('waiting', handleWaiting);
    
    // Aplica a velocidade quando o vídeo começar a tocar (garante que está correta)
    const handlePlaying = () => {
      // Só aplica se a velocidade estiver diferente (evita loops)
      if (Math.abs(video.playbackRate - playbackRate) > 0.01) {
        video.playbackRate = playbackRate;
        console.log('[VideoPlayer] 🔄 Velocidade aplicada no evento playing:', playbackRate, 'x');
      }
      handlePlay();
    };
    
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('progress', () => {
      // Monitora progresso do buffer
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / video.duration) * 100;
        if (bufferedPercent > 0 && !isNaN(bufferedPercent)) {
          // Se já tem buffer significativo, não mostra loading
          if (bufferedPercent > 5 && isLoading) {
            setIsLoading(false);
          }
        }
      }
    });

    // Inicia o salvamento periódico se estiver tocando
    if (!video.paused) {
      startSavingProgress();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleMetadataLoaded);
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      
      // Salva progresso final quando o componente for desmontado
      if (video.currentTime && video.duration) {
        saveVideoProgress(file.id, file.name, video.currentTime, video.duration);
      }
      
      if (saveProgressInterval) {
        clearInterval(saveProgressInterval);
      }
    };
  }, [videoUrl, playbackRate, file.id, file.name, isLoading]);

  // Atualiza a velocidade quando muda - versão mais robusta
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Função para aplicar a velocidade com força
    const applyPlaybackRate = () => {
      try {
        const currentRate = video.playbackRate;
        
        // Aplica a velocidade independente do readyState
        video.playbackRate = playbackRate;
        
        // Verifica se foi aplicado corretamente
        if (Math.abs(video.playbackRate - playbackRate) > 0.01) {
          console.warn('[VideoPlayer] ⚠️ Velocidade não foi aplicada corretamente. Esperado:', playbackRate, 'Atual:', video.playbackRate);
          // Tenta novamente
          setTimeout(() => {
            video.playbackRate = playbackRate;
            console.log('[VideoPlayer] 🔄 Tentativa de reaplicar velocidade:', video.playbackRate, 'x');
          }, 50);
        } else {
          console.log('[VideoPlayer] ✅ Velocidade aplicada via useEffect:', playbackRate, 'x');
        }
      } catch (error) {
        console.error('[VideoPlayer] ❌ Erro ao aplicar velocidade:', error);
      }
    };

    // Aplica imediatamente
    applyPlaybackRate();

    // Monitora eventos do vídeo para garantir que a velocidade seja mantida
    const handleLoadedMetadata = () => {
      applyPlaybackRate();
    };

    const handleCanPlay = () => {
      applyPlaybackRate();
    };

    const handlePlay = () => {
      // Sempre aplica a velocidade quando o vídeo começar a tocar
      if (Math.abs(video.playbackRate - playbackRate) > 0.01) {
        video.playbackRate = playbackRate;
        console.log('[VideoPlayer] 🔄 Velocidade reaplicada no evento play:', playbackRate, 'x');
      }
    };

    const handleTimeUpdate = () => {
      // Verifica periodicamente se a velocidade foi resetada (apenas a cada 2 segundos para não sobrecarregar)
      if (Date.now() % 2000 < 100 && Math.abs(video.playbackRate - playbackRate) > 0.01) {
        video.playbackRate = playbackRate;
        console.log('[VideoPlayer] 🔄 Velocidade corrigida no timeupdate:', playbackRate, 'x');
      }
    };

    // Adiciona listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [playbackRate]);

  // Fecha o menu de velocidade ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Usa setTimeout para garantir que o clique no botão seja processado primeiro
      setTimeout(() => {
        if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
          setShowSpeedMenu(false);
        }
      }, 100);
    };

    if (showSpeedMenu) {
      // Usa 'click' ao invés de 'mousedown' para dar tempo do onClick do botão ser executado
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  }, [showSpeedMenu]);

  // Controles de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      // Não processa teclas se o usuário estiver digitando em um input/textarea
      // ou se o formulário de anotação estiver aberto
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        showAnnotationForm
      ) {
        return; // Permite comportamento padrão para inputs
      }

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime -= 10;
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime += 10;
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, showAnnotationForm]);

  // Mostra/oculta controles ao mover o mouse
  useEffect(() => {
    if (isHovering) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    }
  }, [isHovering, isPlaying]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) {
      console.error('[VideoPlayer] ❌ Referência do vídeo não encontrada');
      return;
    }

    // Verifica se o vídeo tem uma fonte válida
    if (!video.src && !videoUrl && !blobUrlRef.current) {
      console.error('[VideoPlayer] ❌ Vídeo não tem fonte válida');
      setError('Vídeo não tem fonte válida. Aguarde o carregamento.');
      return;
    }

    if (video.paused) {
      // Se o vídeo está pausado, verifica se tem fonte antes de tentar tocar
      if (!video.src) {
        console.warn('[VideoPlayer] ⚠️ Vídeo não tem src, aguardando...');
        
        // Se não tem src mas tem videoUrl, tenta definir
        if (videoUrl) {
          video.src = videoUrl;
          video.load();
        }
        
        // Aguarda um pouco para o vídeo carregar
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Verifica se tem dados suficientes
      if (video.readyState === 0) {
        console.warn('[VideoPlayer] ⚠️ Vídeo ainda não tem metadados, aguardando...');
        setIsLoading(true);
        
        // Aguarda metadados serem carregados
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            resolve();
          } else {
            const handleLoadedMetadata = () => {
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              resolve();
            };
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            
            // Timeout de segurança
            setTimeout(() => {
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              resolve();
            }, 3000);
          }
        });
      }
      
      try {
        // Tenta tocar imediatamente - navegadores modernos fazem buffering inteligente
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setIsLoading(false);
          console.log('[VideoPlayer] ✅ Vídeo tocando');
        } else {
          // Fallback para navegadores antigos
          setIsPlaying(true);
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('[VideoPlayer] ❌ Erro ao tocar vídeo:', error);
        setIsLoading(true);
        
        // Se falhar por "no supported sources", verifica se o vídeo tem src
        if (error.name === 'NotSupportedError' || error.message?.includes('no supported sources')) {
          console.log('[VideoPlayer] Erro: no supported sources');
          
          // Verifica se o vídeo tem src válido
          if (!video.src && videoUrl) {
            console.log('[VideoPlayer] Vídeo não tem src, definindo...');
            video.src = videoUrl;
            video.load();
            
            // Aguarda metadados serem carregados
            await new Promise<void>((resolve) => {
              if (video.readyState >= 1) {
                resolve();
              } else {
                const handleLoadedMetadata = () => {
                  video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                  resolve();
                };
                video.addEventListener('loadedmetadata', handleLoadedMetadata);
                setTimeout(() => {
                  video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                  resolve();
                }, 3000);
              }
            });
            
            // Tenta tocar novamente
            try {
              await video.play();
              setIsPlaying(true);
              setIsLoading(false);
              console.log('[VideoPlayer] ✅ Vídeo tocando após definir src');
              return;
            } catch (retryError: any) {
              console.error('[VideoPlayer] ❌ Erro ao tocar após definir src:', retryError);
              setError('Erro ao carregar vídeo. Verifique o console para mais detalhes.');
              setIsLoading(false);
              return;
            }
          } else {
            setError('Vídeo não tem fonte válida. Aguarde o carregamento.');
            setIsLoading(false);
            return;
          }
        }
        
        // Se falhar por falta de buffer, aguarda um pouco e tenta novamente
        if (error.name === 'NotAllowedError' || video.readyState < 3) {
          const waitForBuffer = () => {
            return new Promise<void>((resolve) => {
              if (video.readyState >= 3) {
                resolve();
              } else {
                const handleCanPlayThrough = () => {
                  video.removeEventListener('canplaythrough', handleCanPlayThrough);
                  resolve();
                };
                video.addEventListener('canplaythrough', handleCanPlayThrough);
                
                // Timeout de segurança - tenta mesmo sem buffer completo
                setTimeout(() => {
                  video.removeEventListener('canplaythrough', handleCanPlayThrough);
                  resolve();
                }, 2000);
              }
            });
          };
          
          await waitForBuffer();
          
          try {
            await video.play();
            setIsPlaying(true);
            setIsLoading(false);
            console.log('[VideoPlayer] ✅ Vídeo tocando após aguardar buffer');
          } catch (retryError: any) {
            console.error('[VideoPlayer] ❌ Erro ao tocar após aguardar buffer:', retryError);
            setError(`Erro ao tocar vídeo: ${retryError.message || 'Erro desconhecido'}`);
            setIsLoading(false);
          }
        } else {
          setError(`Erro ao tocar vídeo: ${error.message || 'Erro desconhecido'}`);
          setIsLoading(false);
        }
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSpeedChange = (speed: number) => {
    console.log('[VideoPlayer] 🎯 handleSpeedChange chamado com velocidade:', speed);
    const video = videoRef.current;
    
    if (!video) {
      console.warn('[VideoPlayer] ⚠️ Referência do vídeo não encontrada ao alterar velocidade');
      setPlaybackRate(speed);
      setShowSpeedMenu(false);
      return;
    }

    // Aplica a velocidade imediatamente, forçando múltiplas vezes se necessário
    const applySpeed = () => {
      try {
        const currentRate = video.playbackRate;
        video.playbackRate = speed;
        
        // Força novamente após um pequeno delay para garantir
        setTimeout(() => {
          if (Math.abs(video.playbackRate - speed) > 0.01) {
            console.warn('[VideoPlayer] ⚠️ Velocidade não foi aplicada, tentando novamente...');
            video.playbackRate = speed;
          }
          
          // Verifica se foi aplicado corretamente
          const finalRate = video.playbackRate;
          if (Math.abs(finalRate - speed) > 0.01) {
            console.error('[VideoPlayer] ❌ FALHA: Velocidade não foi aplicada! Esperado:', speed, 'Atual:', finalRate);
          } else {
            console.log('[VideoPlayer] ✅ Velocidade aplicada com sucesso:', finalRate, 'x');
          }
        }, 100);
        
        console.log('[VideoPlayer] ✅ Velocidade alterada para:', speed, 'x (via handleSpeedChange)');
        console.log('[VideoPlayer] 📊 Antes:', currentRate, 'x → Depois:', video.playbackRate, 'x');
      } catch (error) {
        console.error('[VideoPlayer] ❌ Erro ao alterar velocidade:', error);
      }
    };

    // Aplica imediatamente
    applySpeed();
    
    // Atualiza o estado
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
    
    // Aplica novamente após um pequeno delay para garantir
    setTimeout(() => {
      const video = videoRef.current;
      if (video && Math.abs(video.playbackRate - speed) > 0.01) {
        console.log('[VideoPlayer] 🔄 Reaplicando velocidade após delay...');
        video.playbackRate = speed;
      }
    }, 200);
  };

  // Funções de anotações
  const handleCreateAnnotation = async () => {
    console.log('[VideoPlayer] handleCreateAnnotation chamado');
    const video = videoRef.current;
    
    if (!video) {
      console.error('[VideoPlayer] ❌ Referência do vídeo não encontrada');
      return;
    }

    if (!annotationComment.trim()) {
      console.warn('[VideoPlayer] ⚠️ Comentário vazio, não criando anotação');
      alert('Por favor, digite um comentário antes de criar a anotação.');
      return;
    }

    console.log('[VideoPlayer] Dados da anotação:', {
      fileId: file.id,
      fileName: file.name,
      currentTime: video.currentTime,
      comment: annotationComment.substring(0, 50) + '...',
    });
    
    try {
      const annotationId = await createAnnotation(
        file.id,
        file.name,
        video.currentTime,
        annotationComment
      );

      if (annotationId) {
        console.log('[VideoPlayer] ✅ Anotação criada com sucesso! ID:', annotationId);
        
        // Recarrega anotações
        console.log('[VideoPlayer] Recarregando lista de anotações...');
        const updatedAnnotations = await getVideoAnnotations(file.id);
        console.log('[VideoPlayer] Anotações recarregadas:', updatedAnnotations.length);
        setAnnotations(updatedAnnotations);
        setAnnotationComment('');
        setShowAnnotationForm(false);
        
        // Mostra feedback visual (opcional)
        console.log('[VideoPlayer] ✅ Processo concluído!');
      } else {
        console.error('[VideoPlayer] ❌ Falha ao criar anotação - annotationId é null');
        alert('Erro ao criar anotação. Verifique o console para mais detalhes.');
      }
    } catch (error: any) {
      console.error('[VideoPlayer] ❌ Erro na função handleCreateAnnotation:', error);
      alert('Erro ao criar anotação: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleEditAnnotation = async () => {
    if (!editingAnnotation || !annotationComment.trim()) return;

    const success = await updateAnnotation(editingAnnotation.id, annotationComment);
    if (success) {
      const updatedAnnotations = await getVideoAnnotations(file.id);
      setAnnotations(updatedAnnotations);
      setEditingAnnotation(null);
      setAnnotationComment('');
      setShowAnnotationForm(false);
    }
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    const success = await deleteAnnotation(annotationId);
    if (success) {
      const updatedAnnotations = await getVideoAnnotations(file.id);
      setAnnotations(updatedAnnotations);
    }
  };

  const handleJumpToAnnotation = (timestamp: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = timestamp;
    setCurrentTime(timestamp);
  };

  const openAnnotationForm = () => {
    const video = videoRef.current;
    if (!video) return;

    // Pausa o vídeo quando abrir o formulário
    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
    }

    setEditingAnnotation(null);
    setAnnotationComment('');
    setShowAnnotationForm(true);
  };

  // Fecha o formulário ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (annotationFormRef.current && !annotationFormRef.current.contains(event.target as Node)) {
        setShowAnnotationForm(false);
        setEditingAnnotation(null);
        setAnnotationComment('');
      }
    };

    if (showAnnotationForm) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAnnotationForm]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  if (isLoading && !videoUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando vídeo...</p>
          <p className="text-gray-500 text-sm mt-2">Isso pode levar alguns instantes</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-gray-400 text-sm">Tente recarregar a página ou verifique suas permissões.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full max-w-full bg-black flex items-center justify-center group overflow-hidden"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        if (isPlaying) {
          controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
          }, 3000);
        }
      }}
    >
      {/* Video */}
      {videoUrl ? (
        <video
          ref={videoRef}
          className="w-full h-full max-w-full object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
          onLoadedMetadata={() => {
            console.log('[VideoPlayer] ✅ Metadados do vídeo carregados');
            setIsLoading(false);
          }}
          onError={(e) => {
            const video = e.currentTarget;
            console.error('[VideoPlayer] ❌ Erro no elemento de vídeo:', video.error);
            
            if (video.error) {
              console.error('[VideoPlayer] Código de erro:', video.error.code, 'Mensagem:', video.error.message);
              
              // Códigos de erro:
              // 1 = MEDIA_ERR_ABORTED - download abortado
              // 2 = MEDIA_ERR_NETWORK - erro de rede
              // 3 = MEDIA_ERR_DECODE - erro ao decodificar
              // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED - formato não suportado ou fonte inválida
              
              let errorMsg = 'Erro ao carregar vídeo';
              if (video.error.code === 1) {
                errorMsg = 'Download do vídeo foi abortado';
              } else if (video.error.code === 2) {
                errorMsg = 'Erro de rede ao carregar vídeo. Verifique sua conexão.';
              } else if (video.error.code === 3) {
                errorMsg = 'Erro ao decodificar vídeo. O formato pode não ser suportado pelo navegador.';
              } else if (video.error.code === 4) {
                errorMsg = 'Formato de vídeo não suportado pelo navegador ou erro ao carregar fonte.';
              }
              
              console.error('[VideoPlayer] Erro final:', errorMsg);
              setError(errorMsg);
              setIsLoading(false);
            } else {
              console.error('[VideoPlayer] ❌ Erro desconhecido no vídeo');
              setError('Erro desconhecido ao carregar vídeo');
              setIsLoading(false);
            }
          }}
          onLoadedData={() => {
            console.log('[VideoPlayer] ✅ Primeiros dados do vídeo carregados');
            setIsLoading(false);
          }}
          controls={false}
          playsInline
          preload={isMobile ? "metadata" : "auto"}
          src={videoUrl}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          Seu navegador não suporta o elemento de vídeo.
        </video>
      ) : (
        <div className="flex items-center justify-center h-full bg-black">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Carregando fonte do vídeo...</p>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Controles */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent transition-opacity duration-300 overflow-visible ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Barra de progresso com marcadores de anotações */}
        <div className="px-2 sm:px-4 pt-2 sm:pt-3 pb-1 sm:pb-2 relative">
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleTimeChange}
              className="w-full h-1.5 sm:h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider relative z-10 touch-manipulation"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`,
              }}
            />
            
            {/* Marcadores de anotações na timeline */}
            {duration > 0 && annotations.map((annotation) => {
              const positionPercent = (annotation.timestamp / duration) * 100;
              return (
                <button
                  key={annotation.id}
                  onClick={() => handleJumpToAnnotation(annotation.timestamp)}
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3 sm:h-3 bg-yellow-500 rounded-full border-2 border-white hover:bg-yellow-400 active:bg-yellow-400 transition-colors z-20 touch-manipulation"
                  style={{ left: `calc(${positionPercent}% - 6px)` }}
                  title={`${formatTime(annotation.timestamp)}: ${annotation.comment.substring(0, 30)}...`}
                />
              );
            })}
          </div>
        </div>

        {/* Controles principais */}
        <div className="px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 flex-wrap overflow-visible">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0"
            title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 sm:w-6 sm:h-6 text-white" />
            ) : (
              <Play className="w-7 h-7 sm:w-6 sm:h-6 text-white" />
            )}
          </button>

          {/* Volume - Escondido em mobile muito pequeno, apenas botão em mobile */}
          <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <button
              onClick={toggleMute}
              className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0"
              title="Mutar (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-6 h-6 sm:w-5 sm:h-5 text-white" />
              ) : (
                <Volume2 className="w-6 h-6 sm:w-5 sm:h-5 text-white" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="hidden sm:block w-20 sm:w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer touch-manipulation"
            />
          </div>

          {/* Tempo - Responsivo */}
          <div className="text-white text-xs sm:text-sm font-mono whitespace-nowrap flex-shrink-0">
            <span className="hidden sm:inline">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <span className="sm:hidden">{formatTime(currentTime)}</span>
          </div>

          {/* Velocidade de reprodução - Escondido em mobile muito pequeno */}
          <div className="relative hidden sm:block" ref={speedMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeedMenu(!showSpeedMenu);
              }}
              className="p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors relative touch-manipulation"
              title={`Velocidade: ${playbackRate}x`}
            >
              <Gauge className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">
                {playbackRate}x
              </span>
            </button>
            
            {showSpeedMenu && (
              <div 
                className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-xl overflow-hidden min-w-[8rem] max-w-[90vw] divide-y-0 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeedChange(speed);
                    }}
                    className={`w-full px-4 py-2.5 sm:py-2 text-left text-sm transition-colors touch-manipulation border-0 ${
                      playbackRate === speed
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 active:bg-gray-700'
                    }`}
                    style={{ borderTop: 'none', borderBottom: 'none' }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Anotações */}
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors relative touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0 overflow-visible"
            title="Anotações"
          >
            <MessageSquare className="w-6 h-6 sm:w-5 sm:h-5 text-white relative z-10" />
            {annotations.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] sm:text-xs font-bold min-w-[20px] sm:min-w-[18px] h-[20px] sm:h-[18px] flex items-center justify-center rounded-full z-30 shadow-lg border-2 border-black sm:border-white px-1 sm:px-1.5">
                {annotations.length > 99 ? '99+' : annotations.length}
              </span>
            )}
          </button>

          {/* Botão para criar anotação no tempo atual - Escondido em mobile */}
          <button
            onClick={openAnnotationForm}
            className="hidden sm:block p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors touch-manipulation"
            title="Adicionar anotação no tempo atual"
          >
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0"
            title="Tela cheia (F)"
          >
            {isFullscreen ? (
              <Minimize className="w-6 h-6 sm:w-5 sm:h-5 text-white" />
            ) : (
              <Maximize className="w-6 h-6 sm:w-5 sm:h-5 text-white" />
            )}
          </button>
        </div>
        
        {/* Controles mobile - Linha adicional para tempo total e botões secundários */}
        <div className="px-2 sm:px-4 pb-2 sm:hidden flex items-center justify-between">
          <div className="text-white text-xs font-mono">
            {formatTime(duration)}
          </div>
          <div className="flex items-center gap-2">
            {/* Botão para criar anotação em mobile */}
            <button
              onClick={openAnnotationForm}
              className="p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors touch-manipulation"
              title="Adicionar anotação"
            >
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </button>
            {/* Velocidade em mobile */}
            <div className="relative" ref={speedMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu(!showSpeedMenu);
                }}
                className="p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors relative touch-manipulation"
                title={`Velocidade: ${playbackRate}x`}
              >
                <Gauge className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                  {playbackRate}x
                </span>
              </button>
              {showSpeedMenu && (
                <div 
                  className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-xl overflow-hidden min-w-[7rem] max-w-[90vw] divide-y-0 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {speedOptions.map((speed) => (
                    <button
                      key={speed}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeedChange(speed);
                      }}
                      className={`w-full px-3 py-2.5 text-left text-sm transition-colors touch-manipulation border-0 ${
                        playbackRate === speed
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 active:bg-gray-700'
                      }`}
                      style={{ borderTop: 'none', borderBottom: 'none' }}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Anotações */}
      {showAnnotations && (
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 md:w-96 max-w-full bg-[#1a1a1a] border-l border-gray-800 overflow-y-auto z-30 shadow-2xl">
          <div className="p-3 sm:p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-[#1a1a1a] z-10">
            <h3 className="text-white font-semibold text-sm sm:text-base">Anotações</h3>
            <button
              onClick={() => setShowAnnotations(false)}
              className="p-2 hover:bg-gray-800 active:bg-gray-700 rounded touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Fechar painel de anotações"
            >
              <X className="w-5 h-5 sm:w-4 sm:h-4 text-gray-400" />
            </button>
          </div>
          
          <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
            {annotations.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">
                Nenhuma anotação ainda. Clique no ícone de comentário para adicionar uma.
              </p>
            ) : (
              annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="bg-[#0f0f0f] p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <button
                      onClick={() => handleJumpToAnnotation(annotation.timestamp)}
                      className="text-blue-400 hover:text-blue-300 active:text-blue-200 text-xs sm:text-sm font-mono flex items-center gap-1.5 p-1.5 rounded touch-manipulation transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 sm:w-3 sm:h-3 flex-shrink-0" />
                      <span>{formatTime(annotation.timestamp)}</span>
                    </button>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingAnnotation(annotation);
                          setAnnotationComment(annotation.comment);
                          setShowAnnotationForm(true);
                        }}
                        className="p-2 sm:p-1 hover:bg-gray-800 active:bg-gray-700 rounded touch-manipulation min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4 sm:w-3 sm:h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnotation(annotation.id)}
                        className="p-2 sm:p-1 hover:bg-gray-800 active:bg-gray-700 rounded touch-manipulation min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 sm:w-3 sm:h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">{annotation.comment}</p>
                  <p className="text-gray-500 text-xs mt-2">
                    {new Date(annotation.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Formulário de Anotação */}
      {showAnnotationForm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
          <div
            ref={annotationFormRef}
            className="bg-[#1a1a1a] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">
                {editingAnnotation ? 'Editar Anotação' : 'Nova Anotação'}
              </h3>
              <button
                onClick={() => {
                  setShowAnnotationForm(false);
                  setEditingAnnotation(null);
                  setAnnotationComment('');
                }}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-2">
                Tempo: <span className="text-blue-400 font-mono">{formatTime(currentTime)}</span>
              </p>
              <textarea
                value={annotationComment}
                onChange={(e) => setAnnotationComment(e.target.value)}
                onKeyDown={(e) => {
                  // Previne que o espaço pause o vídeo quando estiver digitando
                  if (e.key === ' ') {
                    e.stopPropagation();
                  }
                  // Enter + Ctrl cria a anotação
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    if (editingAnnotation) {
                      handleEditAnnotation();
                    } else {
                      handleCreateAnnotation();
                    }
                  }
                }}
                placeholder="Digite seu comentário ou anotação... (Ctrl+Enter para salvar)"
                className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                rows={4}
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAnnotationForm(false);
                  setEditingAnnotation(null);
                  setAnnotationComment('');
                }}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[VideoPlayer] Botão Criar clicado');
                  if (editingAnnotation) {
                    handleEditAnnotation();
                  } else {
                    handleCreateAnnotation();
                  }
                }}
                disabled={!annotationComment.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {editingAnnotation ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Play button central (quando pausado) */}
      {!isPlaying && showControls && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}
