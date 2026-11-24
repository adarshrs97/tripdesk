import { describe, it, expect } from 'vitest';
import { detectLedgerAnomalies, DayLedgerEntry } from '../engine';

describe('Milestone 3: Validation & Anomaly Detection Engine', () => {
  it('detects negative KM as a critical anomaly', () => {
    const entries: DayLedgerEntry[] = [
      { date: '2026-08-01', dayStatus: 'RUN', startKm: 1000, closeKm: 950 },
    ];

    const anomalies = detectLedgerAnomalies(entries);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].type).toBe('KM_NEGATIVE');
    expect(anomalies[0].severity).toBe('critical');
  });

  it('detects KM continuity gap exceeding configurable threshold (default 15 km)', () => {
    // Exact contiguous rows from Aug 2026 ledger:
    // Aug 1: Cl 155670. Aug 3: St 155705. Gap = 35 km (> 15 km, flagged)
    // Aug 3: Cl 155823. Aug 4: St 155833. Gap = 10 km (<= 15 km, not flagged)
    // Aug 14: Cl 156565. Aug 15: St 156570, Cl 156578. Gap = 5 km (<= 15 km, not flagged)
    // Aug 15: Cl 156578. Aug 16: St 156632. Gap = 54 km (> 15 km, flagged)
    const entries: DayLedgerEntry[] = [
      { date: '2026-08-01', dayStatus: 'RUN', startKm: 155622, closeKm: 155670 },
      { date: '2026-08-02', dayStatus: 'SUNDAY', usedKm: 0 },
      { date: '2026-08-03', dayStatus: 'RUN', startKm: 155705, closeKm: 155823 }, // Gap = 35 km -> flagged
      { date: '2026-08-04', dayStatus: 'RUN', startKm: 155833, closeKm: 155881 }, // Gap = 10 km -> NOT flagged
    ];

    const anomalies1 = detectLedgerAnomalies(entries, { kmGapThreshold: 15 });
    const gapAnomalies1 = anomalies1.filter((a) => a.type === 'KM_GAP');
    expect(gapAnomalies1.length).toBe(1);
    expect(gapAnomalies1[0].entryDate).toBe('2026-08-03');
    expect(gapAnomalies1[0].details?.gap).toBe(35);
    // Aug 4 (gap 10 km <= 15 km) not flagged
    expect(gapAnomalies1.find((a) => a.entryDate === '2026-08-04')).toBeUndefined();

    // Aug 15 to Aug 16 test:
    const entriesAug15_16: DayLedgerEntry[] = [
      { date: '2026-08-14', dayStatus: 'RUN', startKm: 156510, closeKm: 156565 },
      { date: '2026-08-15', dayStatus: 'RUN', startKm: 156570, closeKm: 156578 }, // Gap = 5 km <= 15 km -> not flagged
      { date: '2026-08-16', dayStatus: 'RUN', startKm: 156632, closeKm: 156829 }, // Gap = 54 km > 15 km -> flagged!
    ];

    const anomalies2 = detectLedgerAnomalies(entriesAug15_16, { kmGapThreshold: 15 });
    const gapAnomalies2 = anomalies2.filter((a) => a.type === 'KM_GAP');
    expect(gapAnomalies2.length).toBe(1);
    expect(gapAnomalies2[0].entryDate).toBe('2026-08-16');
    expect(gapAnomalies2[0].details?.gap).toBe(54);
    // Aug 15 (gap 5 km <= 15 km) not flagged
    expect(gapAnomalies2.find((a) => a.entryDate === '2026-08-15')).toBeUndefined();

    // Higher threshold 60 km -> does not flag 54 km gap
    const anomaliesRelaxed = detectLedgerAnomalies(entriesAug15_16, { kmGapThreshold: 60 });
    expect(anomaliesRelaxed.filter((a) => a.type === 'KM_GAP').length).toBe(0);
  });

  it('tracks KM continuity per vehicle so substitute vehicle does not create false gaps', () => {
    const entries: DayLedgerEntry[] = [
      // Regular car KL01 CP 3284
      { date: '2026-08-19', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156911, closeKm: 157101 },
      // Substitute car KL74 E 3694
      { date: '2026-08-20', dayStatus: 'SUBSTITUTE', vehiclePlate: 'KL74 E 3694', startKm: 41834, closeKm: 41884 },
      // Regular car KL01 CP 3284 returns on Aug 21 (starts at 157107, gap from Aug 19 is 6 km <= 15 km)
      { date: '2026-08-21', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157107, closeKm: 157190 },
    ];

    const anomalies = detectLedgerAnomalies(entries, { kmGapThreshold: 15 });
    const gapAnomalies = anomalies.filter((a) => a.type === 'KM_GAP');
    expect(gapAnomalies.length).toBe(0); // 0 false gap anomalies
  });

  it('detects excessive duty hours beyond 16h limit', () => {
    const entries: DayLedgerEntry[] = [
      { date: '2026-08-01', dayStatus: 'RUN', durationMinutes: 1020 }, // 17 hours
    ];

    const anomalies = detectLedgerAnomalies(entries);
    const hrAnomaly = anomalies.find((a) => a.type === 'EXCESSIVE_HOURS');
    expect(hrAnomaly).toBeDefined();
    expect(hrAnomaly?.details?.durationMinutes).toBe(1020);
  });

  it('flags Sunday runs and Kerala statutory holidays (e.g. Onam)', () => {
    const entries: DayLedgerEntry[] = [
      { date: '2026-08-02', dayStatus: 'RUN', usedKm: 45, durationMinutes: 300 }, // Aug 2, 2026 is Sunday
      { date: '2026-08-26', dayStatus: 'RUN', usedKm: 50, durationMinutes: 360 }, // Aug 26, 2026 is Onam
    ];

    const anomalies = detectLedgerAnomalies(entries, {
      keralaHolidays: ['2026-08-26', '2026-08-28'],
    });

    const holidayAnomalies = anomalies.filter((a) => a.type === 'HOLIDAY_RUN');
    expect(holidayAnomalies.length).toBe(2);
    expect(holidayAnomalies[0].title).toBe('Sunday Run');
    expect(holidayAnomalies[1].title).toBe('Holiday Run');
  });

  it('suggests Night Bata when start < 06:00 or close > 22:00 if toggle is OFF', () => {
    const entries: DayLedgerEntry[] = [
      // 05:00 start, nightBata false -> suggest
      { date: '2026-08-01', dayStatus: 'RUN', startTime: '05:00', closeTime: '18:00', nightBata: false },
      // 05:00 start, nightBata true -> OK
      { date: '2026-08-22', dayStatus: 'RUN', startTime: '05:00', closeTime: '18:00', nightBata: true },
    ];

    const anomalies = detectLedgerAnomalies(entries);
    const missingBata = anomalies.find((a) => a.id === 'anomaly-2026-08-01-night-bata-missing');
    expect(missingBata).toBeDefined();
    expect(missingBata?.title).toBe('Night Bata Suggested');

    const okBata = anomalies.find((a) => a.id === 'anomaly-2026-08-22-night-bata-missing');
    expect(okBata).toBeUndefined();
  });
});
