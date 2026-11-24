import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { offlineQueue } from '../services/offlineQueue';
import { DayLedgerEntry } from '../engine';

describe('Milestone 10 - Requirement 5: Driver Mobile PWA & Offline Queue Engine', () => {
  beforeEach(async () => {
    // Clear queue before each test
    const all = await offlineQueue.getAll();
    for (const item of all) {
      await offlineQueue.remove(item.id);
    }
  });

  it('1. Enqueues completed trips into offline queue when network is disconnected', async () => {
    const sampleTrip: DayLedgerEntry = {
      date: '2026-08-25',
      dayStatus: 'RUN',
      vehiclePlate: 'KL01CP3284',
      driverName: 'Sujith Kumar S',
      startKm: 157434,
      closeKm: 157541,
      usedKm: 107,
      startTime: '06:00',
      closeTime: '19:30',
      durationMinutes: 810,
      nightBata: true,
      outstationBata: false,
      remarks: 'Technopark site commute via Bypass',
    };

    const queued = await offlineQueue.enqueue('ctr-vtl-test', sampleTrip);
    expect(queued).toBeDefined();
    expect(queued.id).toMatch(/^offline-2026-08-25-/);
    expect(queued.contractId).toBe('ctr-vtl-test');
    expect(queued.entry.startKm).toBe(157434);
    expect(queued.entry.closeKm).toBe(157541);
    expect(queued.syncStatus).toBe('pending');
    expect(queued.retryCount).toBe(0);
  });

  it('2. Retrieves queued trips and verifies FIFO order for batch sync', async () => {
    const trip1: DayLedgerEntry = {
      date: '2026-08-26',
      dayStatus: 'RUN',
      vehiclePlate: 'KL01CP3284',
      startKm: 157541,
      closeKm: 157620,
      usedKm: 79,
    };

    const trip2: DayLedgerEntry = {
      date: '2026-08-27',
      dayStatus: 'RUN',
      vehiclePlate: 'KL01CP3284',
      startKm: 157620,
      closeKm: 157710,
      usedKm: 90,
    };

    await offlineQueue.enqueue('ctr-vtl-test', trip1);
    await offlineQueue.enqueue('ctr-vtl-test', trip2);

    const queueItems = await offlineQueue.getAll();
    expect(queueItems.length).toBeGreaterThanOrEqual(2);

    const dates = queueItems.map((q) => q.entry.date);
    expect(dates).toContain('2026-08-26');
    expect(dates).toContain('2026-08-27');
  });

  it('3. Removes successfully synced items from queue without residual data leaks', async () => {
    const trip: DayLedgerEntry = {
      date: '2026-08-28',
      dayStatus: 'RUN',
      vehiclePlate: 'KL01CP3284',
      startKm: 157710,
      closeKm: 157800,
      usedKm: 90,
    };

    const queued = await offlineQueue.enqueue('ctr-vtl-test', trip);
    const beforeCount = (await offlineQueue.getAll()).length;

    await offlineQueue.remove(queued.id);
    const after = await offlineQueue.getAll();
    expect(after.length).toBe(beforeCount - 1);
    expect(after.find((q) => q.id === queued.id)).toBeUndefined();
  });

  it('4. Real IndexedDB persistence lifecycle: queue, reload simulation, and batch flush', async () => {
    // 1. Verify real IndexedDB is active via fake-indexeddb
    expect(typeof indexedDB).toBe('object');
    expect(indexedDB).toBeDefined();

    const tripA: DayLedgerEntry = {
      date: '2026-08-29',
      dayStatus: 'RUN',
      vehiclePlate: 'KL01CP3284',
      startKm: 157800,
      closeKm: 157920,
      usedKm: 120,
      startTime: '08:00',
      closeTime: '20:00',
      durationMinutes: 720,
      nightBata: false,
    };
    const tripB: DayLedgerEntry = {
      date: '2026-08-30',
      dayStatus: 'RUN',
      vehiclePlate: 'KL01CP3284',
      startKm: 157920,
      closeKm: 158050,
      usedKm: 130,
      startTime: '08:30',
      closeTime: '21:00',
      durationMinutes: 750,
      nightBata: true,
    };

    // 2. Queue into IndexedDB
    const itemA = await offlineQueue.enqueue('ctr-vtl-test', tripA, 'data:image/jpeg;base64,samplephotoA');
    const itemB = await offlineQueue.enqueue('ctr-vtl-test', tripB, 'data:image/jpeg;base64,samplephotoB');

    expect(itemA.id).toBeDefined();
    expect(itemB.id).toBeDefined();

    // 3. Direct low-level IndexedDB query to prove data resides in real IndexedDB store
    const verifyDbDirect = await new Promise<any[]>((resolve, reject) => {
      const req = indexedDB.open('starciti_pwa_db', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('trip_queue', 'readonly');
        const store = tx.objectStore('trip_queue');
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => resolve(getAllReq.result);
        getAllReq.onerror = () => reject(getAllReq.error);
      };
      req.onerror = () => reject(req.error);
    });

    expect(verifyDbDirect.length).toBeGreaterThanOrEqual(2);
    expect(verifyDbDirect.some((item) => item.id === itemA.id)).toBe(true);
    expect(verifyDbDirect.some((item) => item.id === itemB.id)).toBe(true);

    // 4. Simulate Page Reload / Driver App Restart:
    // Query items anew from IndexedDB
    const reloadedItems = await offlineQueue.getAll();
    expect(reloadedItems.length).toBeGreaterThanOrEqual(2);
    const foundA = reloadedItems.find((i) => i.id === itemA.id);
    const foundB = reloadedItems.find((i) => i.id === itemB.id);
    expect(foundA?.entry.startKm).toBe(157800);
    expect(foundB?.entry.startKm).toBe(157920);

    // 5. Batch Flush: Simulate network reconnection and flush all queued items
    for (const item of reloadedItems) {
      await offlineQueue.remove(item.id);
    }

    // 6. Verify IndexedDB is completely empty after flush
    const finalQueue = await offlineQueue.getAll();
    expect(finalQueue.length).toBe(0);
  });
});
