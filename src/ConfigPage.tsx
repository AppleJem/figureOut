import { useState, useEffect } from 'react';
import type { ImageFile } from './types';
import {
  saveDirectoryHandles,
  loadDirectoryHandles,
  saveInterval,
  loadInterval,
} from './storage';

interface Props {
  onStart: (images: ImageFile[], intervalSec: number) => void;
}

interface FolderEntry {
  handle: FileSystemDirectoryHandle;
  name: string;
  images: ImageFile[];
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
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  // On mount, restore saved folders
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const handles = await loadDirectoryHandles();
        if (cancelled || handles.length === 0) {
          setRestoring(false);
          return;
        }

        const restored: FolderEntry[] = [];

        for (const handle of handles) {
          if (cancelled) break;
          try {
            const perm =
              (await handle.queryPermission({ mode: 'read' })) === 'granted' ||
              (await handle.requestPermission({ mode: 'read' })) === 'granted';
            if (!perm) continue;

            const images = await readImagesFromHandle(handle);
            restored.push({ handle, name: handle.name, images });
          } catch {
            // skip handles that are no longer valid
          }
        }

        if (!cancelled) {
          setFolders(restored);
        }
      } catch {
        // saved handles failed to load
      }
      if (!cancelled) setRestoring(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistFolders = (entries: FolderEntry[]) => {
    saveDirectoryHandles(entries.map((f) => f.handle));
  };

  const handleAddFolder = async () => {
    setError(null);
    try {
      const dirHandle = await window.showDirectoryPicker();
      // Don't add duplicates
      if (folders.some((f) => f.name === dirHandle.name)) {
        setError(`Folder "${dirHandle.name}" is already added.`);
        return;
      }

      const images = await readImagesFromHandle(dirHandle);
      const entry: FolderEntry = {
        handle: dirHandle,
        name: dirHandle.name,
        images,
      };

      const updated = [...folders, entry];
      setFolders(updated);
      persistFolders(updated);

      if (images.length === 0) {
        setError(`No images found in "${dirHandle.name}".`);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(
          'Failed to read folder. Make sure your browser supports the File System Access API.',
        );
      }
    }
  };

  const handleRemoveFolder = (index: number) => {
    const updated = folders.filter((_, i) => i !== index);
    // Revoke URLs for removed folder
    for (const img of folders[index].images) {
      URL.revokeObjectURL(img.url);
    }
    setFolders(updated);
    persistFolders(updated);
  };

  const totalImages = folders.reduce((sum, f) => sum + f.images.length, 0);

  const handleIntervalChange = (sec: number) => {
    setIntervalSec(sec);
    saveInterval(sec);
  };

  const handleStart = () => {
    if (folders.length === 0) {
      setError('Please add at least one folder with images.');
      return;
    }
    // Combine all images from all folders
    const allImages: ImageFile[] = [];
    for (const folder of folders) {
      allImages.push(...folder.images);
    }
    onStart(allImages, intervalSec);
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

        {/* Folder list */}
        <div className="mb-8">
          {folders.length > 0 && (
            <ul className="space-y-3 mb-4">
              {folders.map((folder, i) => (
                <li
                  key={folder.name}
                  className="flex items-center gap-3 bg-zinc-800 rounded-xl px-4 py-3"
                >
                  <span className="text-zinc-400 text-lg">📁</span>
                  <span className="flex-1 text-white text-base truncate">
                    {folder.name}
                  </span>
                  <span className="text-zinc-500 text-sm tabular-nums shrink-0">
                    {folder.images.length} img
                  </span>
                  <button
                    onClick={() => handleRemoveFolder(i)}
                    title="Remove folder"
                    className="text-zinc-500 hover:text-red-400 text-lg leading-none cursor-pointer shrink-0 transition-colors"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Total count */}
          {!restoring && totalImages > 0 && (
            <p className="text-base text-zinc-400 mb-3 text-center">
              {totalImages} image{totalImages !== 1 ? 's' : ''} across{' '}
              {folders.length} folder{folders.length !== 1 ? 's' : ''}
            </p>
          )}

          <button
            onClick={handleAddFolder}
            disabled={restoring}
            className="w-full py-5 px-6 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 border-dashed rounded-2xl text-white text-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {restoring
              ? 'Restoring saved folders…'
              : folders.length === 0
                ? '+  Add Image Folder'
                : '+  Add Another Folder'}
          </button>
        </div>

        {/* Interval setting */}
        <div className="mb-10">
          <label className="block text-base text-zinc-400 mb-3">
            Interval
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={10}
              max={600}
              step={10}
              value={intervalSec}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="flex-1 h-2 accent-white cursor-pointer"
            />
            <span className="text-white font-mono text-xl w-24 text-right tabular-nums">
              {formatTime(intervalSec)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-zinc-600 mt-2 px-1">
            <span>10s</span>
            <span>10m</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-base mb-6 text-center">{error}</p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={totalImages === 0 || restoring}
          className="w-full py-5 px-6 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-black text-xl font-bold rounded-2xl transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          ▶  Start Slideshow
        </button>
      </div>

      {/* GitHub link */}
      <a
        href="https://github.com/AppleJem/figureOut"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-6 right-6 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
        title="View on GitHub"
      >
        GitHub ↗
      </a>
    </div>
  );
}
