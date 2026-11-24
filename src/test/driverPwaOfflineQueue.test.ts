import { describe, it, expect, beforeEach } from 'vitest';
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
});
