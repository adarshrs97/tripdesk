// Types for Excel Import Wizard and Issue Detection
import { DayLedgerEntry } from '../types';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ImportIssue {
  id: string;
  rowNumber: number; // 1-based index in Excel
  column: string;    // e.g. 'Date', 'Start KM', 'Vehicle', 'ST Time'
  rawValue: any;
  severity: IssueSeverity;
  code:
    | 'INVALID_DATE'
    | 'DATE_OUT_OF_ORDER'
    | 'TYPO_VEHICLE_PLATE'
    | 'DECIMAL_KM_TYPO'
    | 'NEGATIVE_KM'
    | 'UNPARSEABLE_TIME'
    | 'MISSING_DRIVER'
    | 'KM_CONTINUITY_GAP'
    | 'SAME_KM_DIFFERENT_DATES'
    | 'EXACT_DUPLICATE_ROW'
    | 'CLOSE_BEFORE_START_TIME'
    | 'ODOMETER_OUTLIER'
    | 'SUMMARY_ROW_SKIPPED'
    | 'EMPTY_NUMBERED_ROW'
    | 'EMBEDDED_ALLOWANCE_FOUND';
  message: string;
  suggestedFix?: any;
  isApplied?: boolean;
}

export interface ParsedSheetResult {
  sheetName: string;
  entries: DayLedgerEntry[];
  issues: ImportIssue[];
  summary: {
    totalRows: number;
    validRows: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

export interface WorkbookImportResult {
  sheetNames: string[];
  sheets: Record<string, ParsedSheetResult>;
  activeSheetName: string;
}
