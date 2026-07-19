const DB_NAME = 'slideshow-preferences';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLES_COUNT_KEY = 'handles-count';
const HANDLE_KEY_PREFIX = 'dir-handle-';
const INTERVAL_KEY = 'slideshow-interval';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandles(handles: FileSystemDirectoryHandle[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Clear old handles
    const oldCount = Number(localStorage.getItem(HANDLES_COUNT_KEY) ?? 0);
    for (let i = 0; i < oldCount; i++) {
      store.delete(HANDLE_KEY_PREFIX + i);
    }
    // Save new handles
    for (let i = 0; i < handles.length; i++) {
      store.put(handles[i], HANDLE_KEY_PREFIX + i);
    }
    localStorage.setItem(HANDLES_COUNT_KEY, String(handles.length));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDirectoryHandles(): Promise<FileSystemDirectoryHandle[]> {
  try {
    const count = Number(localStorage.getItem(HANDLES_COUNT_KEY) ?? 0);
    if (count === 0) return [];

    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const handles: FileSystemDirectoryHandle[] = [];
      let loaded = 0;

      for (let i = 0; i < count; i++) {
        const req = store.get(HANDLE_KEY_PREFIX + i);
        req.onsuccess = () => {
          loaded++;
          if (req.result) handles[i] = req.result;
          if (loaded === count) resolve(handles.filter(Boolean));
        };
        req.onerror = () => {
          loaded++;
          if (loaded === count) resolve(handles.filter(Boolean));
        };
      }
    });
  } catch {
    return [];
  }
}

export function saveInterval(sec: number): void {
  localStorage.setItem(INTERVAL_KEY, String(sec));
}

export function loadInterval(): number {
  const val = localStorage.getItem(INTERVAL_KEY);
  if (val) {
    const n = Number(val);
    if (n >= 10 && n <= 600) return n;
  }
  return 10;
}
