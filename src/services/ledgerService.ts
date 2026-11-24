// Daily Trip Ledger Service - Database Sync & State Management
import { DayLedgerEntry, detectLedgerAnomalies, LedgerAnomaly } from '../engine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { approvalTokenService } from './approvalTokenService';

export interface MonthApprovalStatus {
  contractId: string;
  yearMonth: string; // YYYY-MM
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  token?: string; // Generated dynamically and shown once to admin
  tokenHash: string;
  expiresAt?: string;
  isRevoked?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  coordinatorDesignation?: string;
  notes?: string;
}

// Exact row-by-row seed verified directly against Log_book_VTL_Aug_2026.xlsx
export const EXACT_SEED_VTL_AUG_2026: DayLedgerEntry[] = [
  { date: '2026-08-01', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 155622, closeKm: 155670, usedKm: 48, startTime: '05:00', closeTime: '18:00', durationMinutes: 780, nightBata: true, outstationBata: false, permit: 0, remarks: 'Kachani, Airport (AVP)' },
  { date: '2026-08-02', dayStatus: 'SUNDAY', vehiclePlate: undefined, startKm: null, closeKm: null, usedKm: 0, durationMinutes: 0 },
  { date: '2026-08-03', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 155705, closeKm: 155823, usedKm: 118, startTime: '06:15', closeTime: '19:30', durationMinutes: 795, remarks: 'Kattakada KSEB' },
  { date: '2026-08-04', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 155833, closeKm: 155881, usedKm: 48, startTime: '08:45', closeTime: '20:00', durationMinutes: 675, remarks: 'Site Trips' },
  { date: '2026-08-05', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 155888, closeKm: 156103, usedKm: 215, startTime: '08:30', closeTime: '21:30', durationMinutes: 780, outstationBata: true, permit: 600, remarks: 'Premit Kaushel Kanyakumari' },
  { date: '2026-08-06', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156110, closeKm: 156184, usedKm: 74, startTime: '08:30', closeTime: '20:00', durationMinutes: 690, remarks: 'Kattakada' },
  { date: '2026-08-07', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156190, closeKm: 156233, usedKm: 43, startTime: '09:00', closeTime: '21:00', durationMinutes: 720, remarks: 'P.H + V.B Trips' },
  { date: '2026-08-08', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156239, closeKm: 156285, usedKm: 46, startTime: '08:45', closeTime: '18:30', durationMinutes: 585, remarks: 'Kachani' },
  { date: '2026-08-09', dayStatus: 'SUNDAY', vehiclePlate: undefined, startKm: null, closeKm: null, usedKm: 0, durationMinutes: 0 },
  { date: '2026-08-10', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156300, closeKm: 156354, usedKm: 54, startTime: '08:45', closeTime: '19:00', durationMinutes: 615, remarks: 'VB, CE' },
  { date: '2026-08-11', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156363, closeKm: 156388, usedKm: 25, startTime: '08:45', closeTime: '19:00', durationMinutes: 615, remarks: 'VB, CE' },
  { date: '2026-08-12', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156395, closeKm: 156465, usedKm: 70, startTime: '09:00', closeTime: '18:30', durationMinutes: 570, remarks: 'Kachani, Airport VP' },
  { date: '2026-08-13', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156472, closeKm: 156505, usedKm: 33, startTime: '08:30', closeTime: '19:00', durationMinutes: 630, remarks: 'VB, CE' },
  { date: '2026-08-14', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156510, closeKm: 156565, usedKm: 55, startTime: '09:00', closeTime: '19:00', durationMinutes: 600, remarks: 'VP trips' },
  { date: '2026-08-15', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156570, closeKm: 156578, usedKm: 8, startTime: '10:15', closeTime: '13:00', durationMinutes: 165, remarks: 'Guest House' },
  { date: '2026-08-16', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156632, closeKm: 156829, usedKm: 197, startTime: '08:00', closeTime: '20:30', durationMinutes: 750, outstationBata: true, permit: 600, remarks: 'Premit Kanyakumari' },
  { date: '2026-08-17', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156840, closeKm: 156874, usedKm: 34, startTime: '09:00', closeTime: '19:00', durationMinutes: 600 },
  { date: '2026-08-18', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156880, closeKm: 156905, usedKm: 25, startTime: '08:45', closeTime: '19:00', durationMinutes: 615 },
  { date: '2026-08-19', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 156911, closeKm: 157101, usedKm: 190, startTime: '09:00', closeTime: '22:00', durationMinutes: 780, outstationBata: true, remarks: 'Kollam' },
  { date: '2026-08-20', dayStatus: 'SUBSTITUTE', vehiclePlate: 'KL74 E 3694', startKm: 41834, closeKm: 41884, usedKm: 50, startTime: '09:00', closeTime: '18:00', durationMinutes: 540, remarks: 'AVP Trips (Afzal substitute)' },
  { date: '2026-08-21', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157107, closeKm: 157190, usedKm: 83, startTime: '09:00', closeTime: '20:30', durationMinutes: 690, remarks: 'AVP Trips' },
  { date: '2026-08-22', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157197, closeKm: 157338, usedKm: 141, startTime: '05:00', closeTime: '20:30', durationMinutes: 930, nightBata: true, remarks: 'Kattakada' },
  { date: '2026-08-23', dayStatus: 'SUNDAY', vehiclePlate: undefined, startKm: null, closeKm: null, usedKm: 0, durationMinutes: 0 },
  { date: '2026-08-24', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157344, closeKm: 157437, usedKm: 93, startTime: '07:00', closeTime: '18:00', durationMinutes: 660 },
  { date: '2026-08-25', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157438, closeKm: 157490, usedKm: 52, startTime: '08:00', closeTime: '12:00', durationMinutes: 240 },
  { date: '2026-08-26', dayStatus: 'HOLIDAY', vehiclePlate: undefined, startKm: null, closeKm: null, usedKm: 0, durationMinutes: 0, remarks: 'ONAM' },
  { date: '2026-08-27', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157497, closeKm: 157519, usedKm: 22, startTime: '09:00', closeTime: '18:00', durationMinutes: 540 },
  { date: '2026-08-28', dayStatus: 'HOLIDAY', vehiclePlate: undefined, startKm: null, closeKm: null, usedKm: 0, durationMinutes: 0, remarks: 'ONAM' },
  { date: '2026-08-29', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157580, closeKm: 157633, usedKm: 53, startTime: '09:00', closeTime: '18:00', durationMinutes: 540, remarks: 'AVP Trips' },
  { date: '2026-08-30', dayStatus: 'SUNDAY', vehiclePlate: undefined, startKm: null, closeKm: null, usedKm: 0, durationMinutes: 0 },
  { date: '2026-08-31', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', startKm: 157641, closeKm: 157748, usedKm: 107, startTime: '08:30', closeTime: '22:00', durationMinutes: 810 },
];

class LedgerService {
  private entries: Map<string, DayLedgerEntry[]> = new Map();
  private approvals: Map<string, MonthApprovalStatus> = new Map();
  private acknowledgedAnomalies: Set<string> = new Set();

  constructor() {
    this.entries.set('vtl-2026-08', [...EXACT_SEED_VTL_AUG_2026]);
    const generated = approvalTokenService.generateSecureToken(90);
    this.approvals.set('vtl-2026-08', {
      contractId: 'b0000000-0000-0000-0000-000000000001',
      yearMonth: '2026-08',
      status: 'pending_approval',
      token: generated.rawToken, // Available on creation to display once
      tokenHash: generated.tokenHash, // Stored hash
      isRevoked: false,
      expiresAt: generated.expiresAt,
    });
  }

  getEntries(contractId = 'vtl', yearMonth = '2026-08'): DayLedgerEntry[] {
    const key = `${contractId}-${yearMonth}`;
    return this.entries.get(key) || this.entries.get('vtl-2026-08') || [];
  }

  async fetchEntriesFromDb(contractId = 'b0000000-0000-0000-0000-000000000001', yearMonth = '2026-08'): Promise<DayLedgerEntry[]> {
    if (isSupabaseConfigured) {
      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-31`;
      const { data, error } = await supabase
        .from('trip_ledger')
        .select('*')
        .eq('contract_id', contractId)
        .gte('trip_date', startDate)
        .lte('trip_date', endDate)
        .order('trip_date', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: DayLedgerEntry[] = data.map((row: any) => ({
          date: row.trip_date,
          dayStatus: row.day_status,
          vehiclePlate: row.vehicle_id ? 'KL01 CP 3284' : undefined,
          startKm: row.start_km,
          closeKm: row.close_km,
          usedKm: row.used_km,
          startTime: row.start_time,
          closeTime: row.close_time,
          durationMinutes: row.duration_minutes,
          nightBata: row.night_bata,
          outstationBata: row.outstation_bata,
          permit: Number(row.permit_amount || 0),
          toll: Number(row.toll_amount || 0),
          remarks: row.remarks,
          extra: row.extra,
        }));
        this.entries.set(`${contractId}-${yearMonth}`, mapped);
        return mapped;
      }
    }
    return this.getEntries(contractId, yearMonth);
  }

  saveEntry(contractId: string, yearMonth: string, entry: DayLedgerEntry): DayLedgerEntry[] {
    const key = `${contractId}-${yearMonth}`;
    const list = this.entries.get(key) || (key === 'vtl-2026-08' ? [...EXACT_SEED_VTL_AUG_2026] : []);
    const entryVeh = (entry.vehiclePlate || 'KL01 CP 3284').trim().toUpperCase();
    const entryStart = entry.startKm ?? -1;

    const idx = list.findIndex(
      (e) =>
        e.date === entry.date &&
        (e.vehiclePlate || 'KL01 CP 3284').trim().toUpperCase() === entryVeh &&
        (e.startKm ?? -1) === entryStart
    );

    if (idx >= 0) {
      list[idx] = { ...entry };
    } else {
      list.push({ ...entry });
      list.sort((a, b) => a.date.localeCompare(b.date));
    }
    this.entries.set(key, list);
    return list;
  }

  /**
   * Idempotent import of multiple entries using composite key: vehicle + date + start_km.
   * Importing the exact same file twice adds 0 new rows.
   */
  importEntries(
    contractId: string,
    yearMonth: string,
    newEntries: DayLedgerEntry[]
  ): { addedCount: number; updatedCount: number; totalCount: number } {
    const key = `${contractId}-${yearMonth}`;
    const list = this.entries.get(key) || (key === 'vtl-2026-08' ? [...EXACT_SEED_VTL_AUG_2026] : []);
    let addedCount = 0;
    let updatedCount = 0;

    for (const entry of newEntries) {
      const entryVeh = (entry.vehiclePlate || 'KL01 CP 3284').trim().toUpperCase();
      const entryStart = entry.startKm ?? -1;

      const idx = list.findIndex(
        (e) =>
          e.date === entry.date &&
          (e.vehiclePlate || 'KL01 CP 3284').trim().toUpperCase() === entryVeh &&
          (e.startKm ?? -1) === entryStart
      );

      if (idx >= 0) {
        list[idx] = { ...list[idx], ...entry };
        updatedCount++;
      } else {
        list.push({ ...entry });
        addedCount++;
      }
    }

    list.sort((a, b) => a.date.localeCompare(b.date));
    this.entries.set(key, list);
    return { addedCount, updatedCount, totalCount: list.length };
  }

  async saveEntryToDb(contractId: string, entry: DayLedgerEntry): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.from('trip_ledger').upsert({
        contract_id: contractId,
        trip_date: entry.date,
        day_status: entry.dayStatus,
        start_km: entry.startKm,
        close_km: entry.closeKm,
        used_km: entry.usedKm,
        start_time: entry.startTime,
        close_time: entry.closeTime,
        duration_minutes: entry.durationMinutes,
        night_bata: entry.nightBata || false,
        outstation_bata: entry.outstationBata || false,
        permit_amount: entry.permit || 0,
        remarks: entry.remarks,
        extra: entry.extra || {},
      });
    }
  }

  detectAnomalies(contractId = 'vtl', yearMonth = '2026-08'): LedgerAnomaly[] {
    const entries = this.getEntries(contractId, yearMonth);
    return detectLedgerAnomalies(entries, { kmGapThreshold: 15 });
  }

  isAnomalyAcknowledged(anomalyId: string): boolean {
    return this.acknowledgedAnomalies.has(anomalyId);
  }

  acknowledgeAnomaly(anomalyId: string): void {
    this.acknowledgedAnomalies.add(anomalyId);
  }

  getApprovalStatus(contractId = 'vtl', yearMonth = '2026-08'): MonthApprovalStatus {
    const key = `${contractId}-${yearMonth}`;
    return (
      this.approvals.get(key) ||
      this.approvals.get('vtl-2026-08') || {
        contractId,
        yearMonth,
        status: 'draft',
        token: `vtl-token-${Date.now()}`,
        tokenHash: '',
      }
    );
  }

  approveMonth(
    contractId: string,
    yearMonth: string,
    approvedBy: string,
    coordinatorDesignation: string,
    notes?: string
  ): MonthApprovalStatus {
    const key = `${contractId}-${yearMonth}`;
    const prev = this.getApprovalStatus(contractId, yearMonth);
    const updated: MonthApprovalStatus = {
      ...prev,
      contractId,
      yearMonth,
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      coordinatorDesignation,
      notes,
    };
    this.approvals.set(key, updated);
    this.approvals.set('vtl-2026-08', updated);
    return updated;
  }
}

export const ledgerService = new LedgerService();
