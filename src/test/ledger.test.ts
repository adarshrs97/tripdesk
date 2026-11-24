import { describe, it, expect } from 'vitest';
import { ledgerService } from '../services/ledgerService';
import { detectLedgerAnomalies } from '../engine';

describe('Milestone 3: Daily Trip Ledger & Approval Tests', () => {
  it('loads seeded August 2026 VTL ledger with exactly 25 run days and 1884 KM', () => {
    const entries = ledgerService.getEntries('vtl', '2026-08');
    expect(entries.length).toBe(31);

    const runEntries = entries.filter((e) => e.dayStatus === 'RUN' || e.dayStatus === 'SUBSTITUTE');
    expect(runEntries.length).toBe(25);

    const totalKm = runEntries.reduce((sum, e) => sum + (e.usedKm || 0), 0);
    expect(totalKm).toBe(1884);

    const totalExtraMinutes = runEntries.reduce((sum, e) => {
      const dur = e.durationMinutes || 0;
      return sum + Math.max(0, dur - 12 * 60);
    }, 0);
    expect(totalExtraMinutes).toBe(585); // 9h 45m

    const nightBataDays = runEntries.filter((e) => e.nightBata).length;
    expect(nightBataDays).toBe(2); // Aug 1, Aug 22

    const outstationBataDays = runEntries.filter((e) => e.outstationBata).length;
    expect(outstationBataDays).toBe(3); // Aug 5, Aug 16, Aug 19

    const totalPermit = runEntries.reduce((sum, e) => sum + (e.permit || 0) + (e.toll || 0), 0);
    expect(totalPermit).toBe(1200); // Aug 5 (600) + Aug 16 (600)
  });

  it('runs anomaly detection and flags the real August 1 to August 3 (35 km) and August 15 to 16 (54 km) gaps', () => {
    const entries = ledgerService.getEntries('vtl', '2026-08');
    const anomalies = detectLedgerAnomalies(entries, { kmGapThreshold: 15 });

    // Look for gap between Aug 1 (close 155670) and Aug 3 (start 155705) = 35 km
    const aug3Gap = anomalies.find((a) => a.entryDate === '2026-08-03' && a.type === 'KM_GAP');
    expect(aug3Gap).toBeDefined();
    expect(aug3Gap?.details?.gap).toBe(35);

    // Look for gap between Aug 15 (close 156578) and Aug 16 (start 156632) = 54 km
    const aug16Gap = anomalies.find((a) => a.entryDate === '2026-08-16' && a.type === 'KM_GAP');
    expect(aug16Gap).toBeDefined();
    expect(aug16Gap?.details?.gap).toBe(54);

    // Verify small gaps <= 15 km are NOT flagged (e.g. Aug 4 has 10 km gap, Aug 21 has 6 km gap)
    expect(anomalies.find((a) => a.entryDate === '2026-08-04' && a.type === 'KM_GAP')).toBeUndefined();
    expect(anomalies.find((a) => a.entryDate === '2026-08-21' && a.type === 'KM_GAP')).toBeUndefined();
  });

  it('handles customer coordinator tokenised approval lifecycle', () => {
    const initial = ledgerService.getApprovalStatus('vtl', '2026-08');
    expect(initial.token).toBeDefined();
    expect(initial.token).toHaveLength(32);
    expect(initial.status).toBe('pending_approval');

    const approved = ledgerService.approveMonth(
      'vtl',
      '2026-08',
      'Mr. A. Sharma',
      'Site Project Manager',
      'Verified against site logbook'
    );

    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('Mr. A. Sharma');
    expect(approved.coordinatorDesignation).toBe('Site Project Manager');
    expect(approved.approvedAt).toBeDefined();

    // Verify persistence
    const reloaded = ledgerService.getApprovalStatus('vtl', '2026-08');
    expect(reloaded.status).toBe('approved');
  });
});
