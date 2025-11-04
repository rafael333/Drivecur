import { useState, useCallback } from 'react';
import { DownloadItem } from '../components/DownloadProgress';

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  const addDownload = useCallback((fileName: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const download: DownloadItem = {
      id,
      fileName,
      progress: 0,
      status: 'downloading',
    };
    setDownloads((prev) => [...prev, download]);
    return id;
  });

  const updateProgress = useCallback((id: string, progress: number) => {
    setDownloads((prev) =>
      prev.map((dl) => (dl.id === id ? { ...dl, progress } : dl))
    );
  });

  const completeDownload = useCallback((id: string) => {
    setDownloads((prev) =>
      prev.map((dl) =>
        dl.id === id ? { ...dl, status: 'completed' as const, progress: 100 } : dl
      )
    );
    // Remove após 3 segundos
    setTimeout(() => {
      setDownloads((prev) => prev.filter((dl) => dl.id !== id));
    }, 3000);
  });

  const errorDownload = useCallback((id: string, error: string) => {
    setDownloads((prev) =>
      prev.map((dl) =>
        dl.id === id ? { ...dl, status: 'error' as const, error } : dl
      )
    );
    // Remove após 5 segundos em caso de erro
    setTimeout(() => {
      setDownloads((prev) => prev.filter((dl) => dl.id !== id));
    }, 5000);
  });

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((dl) => dl.id !== id));
  });

  return {
    downloads,
    addDownload,
    updateProgress,
    completeDownload,
    errorDownload,
    removeDownload,
  };
}






