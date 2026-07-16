import { useState, useCallback, useEffect } from 'react';
import type { ImageFile, AppPage } from './types';
import ConfigPage from './ConfigPage';
import DisplayPage from './DisplayPage';

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function App() {
  const [page, setPage] = useState<AppPage>('config');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [intervalSec, setIntervalSec] = useState(5);

  const handleStart = useCallback((files: ImageFile[], sec: number) => {
    setImages(shuffleArray(files));
    setIntervalSec(sec);
    setPage('display');
  }, []);

  const handleBackToConfig = useCallback(() => {
    // Revoke object URLs to free memory
    for (const img of images) {
      URL.revokeObjectURL(img.url);
    }
    setImages([]);
    setPage('config');
  }, [images]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const img of images) {
        URL.revokeObjectURL(img.url);
      }
    };
  }, [images]);

  if (page === 'config') {
    return <ConfigPage onStart={handleStart} />;
  }

  return (
    <DisplayPage
      images={images}
      intervalSec={intervalSec}
      onBackToConfig={handleBackToConfig}
    />
  );
}
