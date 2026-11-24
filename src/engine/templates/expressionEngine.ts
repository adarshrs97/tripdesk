// Safe Formula & Expression Engine - Powered by expr-eval (Zero eval / Function constructor)
import { Parser } from 'expr-eval';

const parser = new Parser({
  operators: {
    in: true,
    assignment: false, // Disallow variable assignment for safety
  },
});

// Add helpful standard math and helper functions
parser.functions.min = Math.min;
parser.functions.max = Math.max;
parser.functions.round = Math.round;
parser.functions.floor = Math.floor;
parser.functions.ceil = Math.ceil;
parser.functions.abs = Math.abs;

/**
 * Validates a formula string syntax without executing it.
 */
export function validateFormula(expr: string): { valid: boolean; error?: string } {
  if (!expr || typeof expr !== 'string' || expr.trim() === '') {
    return { valid: true };
  }

  const trimmed = expr.trim();

  // If it's a simple property path like "row.usedKm" or "outputs.fixedAmount"
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(trimmed)) {
    return { valid: true };
  }

  try {
    parser.parse(trimmed);
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Syntax error in formula' };
  }
}

/**
 * Evaluates a formula or property path against a provided context object.
 * Context typically contains:
 * {
 *   row: { ...ledgerRow, lineTotal, durationFormatted, ... },
 *   outputs: { fixedAmount, extraHoursAmount, ... },
 *   contract: { ... },
 *   invoice: { ... }
 * }
 */
export function evaluateFormula(expr: string, context: Record<string, any>): any {
  if (expr === null || expr === undefined) return null;
  const trimmed = String(expr).trim();
  if (trimmed === '') return null;

  // 1. Quick check for direct dotted path (e.g. "row.date", "outputs.extraHoursAmount")
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(trimmed)) {
    const parts = trimmed.split('.');
    let current: any = context;
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    return current;
  }

  // 2. Safe expression parsing with expr-eval
  try {
    const parsed = parser.parse(trimmed);
    return parsed.evaluate(context);
  } catch (err: any) {
    console.warn(`Formula evaluation error on "${trimmed}":`, err.message);
    return null;
  }
}
