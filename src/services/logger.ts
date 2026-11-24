// ==============================================================================
// Milestone 9: Client Error & Audit Logging Service
// Formats runtime diagnostics and dispatches to console and Supabase audit_logs
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  error?: Error | null;
  timestamp: string;
}

export class Logger {
  public static info(message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    console.info(`[INFO] ${entry.timestamp} - ${message}`, context || '');
  }

  public static warn(message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    console.warn(`[WARN] ${entry.timestamp} - ${message}`, context || '');
  }

  public static error(message: string, error?: any, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      error: error instanceof Error ? error : error ? new Error(String(error)) : null,
      context,
      timestamp: new Date().toISOString(),
    };

    console.error(`[ERROR] ${entry.timestamp} - ${message}`, error, context || '');

    // Persist critical error to Supabase audit_logs if available
    if (isSupabaseConfigured) {
      try {
        supabase
          .from('audit_logs')
          .insert({
            action: 'client_error_captured',
            entity_type: 'frontend_runtime',
            entity_id: context?.viewId || 'app_root',
            details: {
              message,
              errorMessage: error?.message || String(error),
              stack: error?.stack || null,
              context: context || {},
              url: window.location.href,
              userAgent: navigator.userAgent,
            },
          })
          .then(({ error: dbErr }) => {
            if (dbErr) {
              console.warn('Failed to persist error to audit_logs:', dbErr.message);
            }
          });
      } catch {
        // Ignore secondary logging failures
      }
    }
  }
}
