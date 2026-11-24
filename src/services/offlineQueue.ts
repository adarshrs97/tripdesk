// Real IndexedDB Offline Queue & Sync Engine with Conflict Handling for Driver PWA
import { DayLedgerEntry } from '../engine';

export interface QueuedTrip {
  id: string; // generated UUID or date-based key
  contractId: string;
  entry: DayLedgerEntry;
  photoBlobBase64?: string;
  queuedAt: string; // ISO timestamp
  syncStatus: 'pending' | 'syncing' | 'failed' | 'conflict';
  syncError?: string;
  retryCount: number;
}

const DB_NAME = 'starciti_pwa_db';
const DB_VERSION = 1;
const STORE_NAME = 'trip_queue';
let memoryQueue: QueuedTrip[] = [];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = typeof indexedDB !== 'undefined'
      ? indexedDB
      : (typeof window !== 'undefined' ? window.indexedDB : undefined);

    if (!idb) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineQueue = {
  /**
   * Enqueues a completed or updated trip into IndexedDB when driver is offline or network fails
   */
  async enqueue(contractId: string, entry: DayLedgerEntry, photoBlobBase64?: string): Promise<QueuedTrip> {
    const item: QueuedTrip = {
      id: `offline-${entry.date}-${Date.now()}`,
      contractId,
      entry,
      photoBlobBase64,
      queuedAt: new Date().toISOString(),
      syncStatus: 'pending',
      retryCount: 0,
    };

    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return item;
    } catch (e) {
      // In-memory or localStorage fallback if IndexedDB is blocked or disabled
      const existing = this.getLocalStorageQueue();
      existing.push(item);
      this.saveLocalStorageQueue(existing);
      return item;
    }
  },

  /**
   * Retrieves all trips currently pending sync in the offline queue
   */
  async getAll(): Promise<QueuedTrip[]> {
    try {
      const db = await openDatabase();
      return new Promise<QueuedTrip[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getLocalStorageQueue();
    }
  },

  /**
   * Removes a successfully synced trip from the offline queue
   */
  async remove(id: string): Promise<void> {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      const items = this.getLocalStorageQueue().filter((t) => t.id !== id);
      this.saveLocalStorageQueue(items);
    }
  },

  /**
   * Counts pending offline items
   */
  async count(): Promise<number> {
    const all = await this.getAll();
    return all.length;
  },

  /**
   * Conflict Resolution Strategy:
   * When syncing a locally modified trip with a server record:
   * 1. If server has no record for the date -> Local wins directly.
   * 2. If server has higher closeKm or different driver entered by office -> Merges driver fields
   *    (preferring driver's latest odometer reading and attached photo evidence, preserving office rate tags).
   */
  resolveConflict(localEntry: DayLedgerEntry, serverEntry: DayLedgerEntry): DayLedgerEntry {
    return {
      ...serverEntry,
      ...localEntry,
      // Always retain genuine odometer readings and times entered from the driver's phone
      startKm: localEntry.startKm ?? serverEntry.startKm,
      closeKm: localEntry.closeKm ?? serverEntry.closeKm,
      usedKm: localEntry.usedKm ?? serverEntry.usedKm,
      startTime: localEntry.startTime ?? serverEntry.startTime,
      closeTime: localEntry.closeTime ?? serverEntry.closeTime,
      durationMinutes: localEntry.durationMinutes ?? serverEntry.durationMinutes,
      // Merge extra JSON metadata
      extra: {
        ...(serverEntry.extra || {}),
        ...(localEntry.extra || {}),
        lastSyncedAt: new Date().toISOString(),
        conflictResolved: true,
      },
    };
  },

  /**
   * Synchronizes all queued trips with server
   */
  async syncAll(
    syncFn: (item: QueuedTrip) => Promise<boolean>
  ): Promise<{ synced: number; failed: number }> {
    const queue = await this.getAll();
    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const success = await syncFn(item);
        if (success) {
          await this.remove(item.id);
          synced++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error('Failed to sync offline trip:', item.id, err);
      }
    }

    return { synced, failed };
  },

  saveLocalStorageQueue(items: QueuedTrip[]): void {
    memoryQueue = [...items];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('starciti_offline_queue', JSON.stringify(items));
      } catch {
        // Fallback to memoryQueue
      }
    }
  },

  getLocalStorageQueue(): QueuedTrip[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('starciti_offline_queue');
        if (raw) return JSON.parse(raw);
      } catch {
        // Fallback
      }
    }
    return memoryQueue;
  },
};
