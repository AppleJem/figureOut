import { useState, useEffect, useCallback, useRef } from 'react';
import type { ImageFile } from './types';

interface Props {
  images: ImageFile[];
  intervalSec: number;
  onBackToConfig: () => void;
}

export default function DisplayPage({ images, intervalSec, onBackToConfig }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(intervalSec);
  const [imagesShown, setImagesShown] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(Date.now());

  const advanceImage = useCallback(() => {
    setIndex((prev) => (prev + 1) % images.length);
    setImagesShown((prev) => prev + 1);
  }, [images.length]);

  const goToPrevious = useCallback(() => {
    setIndex((prev) => (prev - 1 + images.length) % images.length);
    setTimeLeft(intervalSec);
    lastTickRef.current = Date.now();
  }, [images.length, intervalSec]);

  const goToNext = useCallback(() => {
    advanceImage();
    setTimeLeft(intervalSec);
    lastTickRef.current = Date.now();
  }, [advanceImage, intervalSec]);

  // Timer logic
  useEffect(() => {
    if (paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    lastTickRef.current = Date.now();
    setTimeLeft(intervalSec);

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      const remaining = intervalSec - elapsed;

      if (remaining <= 0) {
        advanceImage();
        lastTickRef.current = now;
        setTimeLeft(intervalSec);
      } else {
        setTimeLeft(remaining);
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, intervalSec, advanceImage]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Listen for fullscreen changes (e.g. user presses Esc)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setPaused((p) => !p);
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          onBackToConfig();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, onBackToConfig]);

  const currentImage = images[index];

  const formatTimeLeft = (sec: number) => {
    const t = Math.ceil(sec);
    const m = Math.floor(t / 60);
    const s = t % 60;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {/* Image */}
      {currentImage && (
        <img
          src={currentImage.url}
          alt={currentImage.file.name}
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}

      {/* Timer at top */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pt-2 pointer-events-none">
        <span className="bg-black/40 backdrop-blur-md rounded-3xl text-white font-mono text-md tabular-nums px-2 py-1 inline-block">
          {formatTimeLeft(timeLeft)}
        </span>
      </div>

      {/* Image number at bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md rounded-3xl px-2 py-1 text-white font-mono text-md tabular-nums">
          {imagesShown}
        </div>
      </div>

      {/* All controls — right side */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4">
        <ControlButton
          onClick={() => setPaused((p) => !p)}
          label={paused ? '▶' : '⏸'}
          title={paused ? 'Resume (Space)' : 'Pause (Space)'}
        />
        <ControlButton
          onClick={goToPrevious}
          label="←"
          title="Previous (←)"
        />
        <ControlButton
          onClick={goToNext}
          label="→"
          title="Next (→)"
        />
        <ControlButton
          onClick={toggleFullscreen}
          label={isFullscreen ? '↙' : '⛶'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        />
        <ControlButton
          onClick={onBackToConfig}
          label="✕"
          title="Back to config (Esc)"
        />
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  title,
}: {
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-16 h-16 flex items-center justify-center bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white text-3xl transition-colors cursor-pointer border border-white/15"
    >
      {label}
    </button>
  );
}
