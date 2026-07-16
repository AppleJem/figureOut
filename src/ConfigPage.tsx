import { useState, useRef, useEffect } from 'react';
import type { ImageFile } from './types';
import {
  saveDirectoryHandle,
  loadDirectoryHandle,
  saveInterval,
  loadInterval,
} from './storage';

interface Props {
  onStart: (images: ImageFile[], intervalSec: number) => void;
}

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff', 'tif',
]);

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

async function readImagesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ImageFile[]> {
  const images: ImageFile[] = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && isImageFile(entry.name)) {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      images.push({ file, url });
    }
  }
  return images;
}

export default function ConfigPage({ onStart }: Props) {
  const [intervalSec, setIntervalSec] = useState(loadInterval);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const filesRef = useRef<ImageFile[]>([]);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // On mount, try to restore saved folder
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const handle = await loadDirectoryHandle();
        if (!handle || cancelled) {
          setRestoring(false);
          return;
        }

        // Check if we still have permission
        const perm =
          (await handle.queryPermission({ mode: 'read' })) === 'granted' ||
          (await handle.requestPermission({ mode: 'read' })) === 'granted';

        if (!perm || cancelled) {
          setRestoring(false);
          return;
        }

        const images = await readImagesFromHandle(handle);
        if (cancelled) return;

        dirHandleRef.current = handle;
        filesRef.current = images;
        setFolderName(handle.name);
        setImageCount(images.length);

        if (images.length === 0) {
          setError('No image files found in the saved folder.');
        }
      } catch {
        // Saved handle is no longer valid
      }
      setRestoring(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickFolder = async () => {
    setError(null);
    try {
      const dirHandle = await window.showDirectoryPicker();
      const images = await readImagesFromHandle(dirHandle);

      dirHandleRef.current = dirHandle;
      filesRef.current = images;
      setFolderName(dirHandle.name);
      setImageCount(images.length);

      // Persist
      await saveDirectoryHandle(dirHandle);

      if (images.length === 0) {
        setError('No image files found in this folder.');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(
          'Failed to read folder. Make sure your browser supports the File System Access API.',
        );
      }
    }
  };

  const handleIntervalChange = (sec: number) => {
    setIntervalSec(sec);
    saveInterval(sec);
  };

  const handleStart = () => {
    if (filesRef.current.length === 0) {
      setError('Please select a folder with images first.');
      return;
    }
    onStart(filesRef.current, intervalSec);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0 && s > 0) return `${m}m ${s}s`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  };

  return (
    <div className="h-full flex items-center justify-center bg-zinc-950 px-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 sm:p-12 w-full max-w-xl shadow-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-10 text-center">
          Image Slideshow
        </h1>

        {/* Folder picker */}
        <div className="mb-10">
          <button
            onClick={handlePickFolder}
            disabled={restoring}
            className="w-full py-5 px-6 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl text-white text-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {restoring
              ? 'Restoring saved folder…'
              : folderName
                ? `📁  ${folderName}`
                : '📁  Choose Image Folder'}
          </button>
          {folderName && !restoring && (
            <p className="text-base text-zinc-400 mt-3 text-center">
              {imageCount} image{imageCount !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Interval setting */}
        <div className="mb-10">
          <label className="block text-base text-zinc-400 mb-3">
            Interval
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={5}
              max={300}
              step={5}
              value={intervalSec}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="flex-1 h-2 accent-white cursor-pointer"
            />
            <span className="text-white font-mono text-xl w-24 text-right tabular-nums">
              {formatTime(intervalSec)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-zinc-600 mt-2 px-1">
            <span>5s</span>
            <span>5m</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-base mb-6 text-center">{error}</p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={filesRef.current.length === 0 || restoring}
          className="w-full py-5 px-6 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-black text-xl font-bold rounded-2xl transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          ▶  Start Slideshow
        </button>
      </div>
    </div>
  );
}
