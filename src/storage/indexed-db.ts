import type { SerializedGame } from './save-data';

const DB_NAME = 'minecraft-2d';
const DB_VERSION = 1;
const STORE_NAME = 'saves';

export const DEFAULT_SAVE_ID = 'default';

interface SaveRecord extends SerializedGame {
  readonly id: string;
}

export function openSaveDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
  });
}

export function loadSavedGame(
  db: IDBDatabase,
  id: string = DEFAULT_SAVE_ID,
): Promise<SerializedGame | null> {
  return runStoreRequest<SaveRecord | undefined>(
    db,
    'readonly',
    (store) => store.get(id) as IDBRequest<SaveRecord | undefined>,
  ).then((record) => {
    if (!record) return null;
    const { id: _id, ...game } = record;
    return game;
  });
}

export function saveGame(
  db: IDBDatabase,
  game: SerializedGame,
  id: string = DEFAULT_SAVE_ID,
): Promise<void> {
  return runStoreRequest<IDBValidKey>(db, 'readwrite', (store) => store.put({ id, ...game })).then(
    () => undefined,
  );
}

function runStoreRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = createRequest(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}
