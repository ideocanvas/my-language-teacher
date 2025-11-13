"use client";

interface StoredFile {
  id: string;
  data: ArrayBuffer;
  type: string;
  fileName: string;
  fileSize: number;
  timestamp: number;
}

class IndexedDBStorage {
  private static instance: IndexedDBStorage;
  private db: IDBDatabase | null = null;
  private readonly dbName = 'P2PClipboardDB';
  private readonly storeName = 'files';
  private readonly version = 1;

  static getInstance(): IndexedDBStorage {
    if (!IndexedDBStorage.instance) {
      IndexedDBStorage.instance = new IndexedDBStorage();
    }
    return IndexedDBStorage.instance;
  }

  async initialize(): Promise<void> {
    if (!globalThis.indexedDB) {
      throw new Error('IndexedDB is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async storeFile(id: string, file: File): Promise<void> {
    if (!this.db) await this.initialize();

    // Read the file data first
    const arrayBuffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const storedFile: StoredFile = {
        id,
        data: arrayBuffer,
        type: file.type,
        fileName: file.name,
        fileSize: file.size,
        timestamp: Date.now()
      };

      const request = store.put(storedFile);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getFile(id: string): Promise<File | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as StoredFile | undefined;
        if (result) {
          const blob = new Blob([result.data], { type: result.type });
          const file = new File([blob], result.fileName, { type: result.type });
          resolve(file);
        } else {
          resolve(null);
        }
      };
    });
  }

  async deleteFile(id: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllFileIds(): Promise<string[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async cleanupOldFiles(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const cutoff = Date.now() - maxAge;

      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}

export const indexedDBStorage = IndexedDBStorage.getInstance();