// ==============================================================================
// Milestone 9: Backup & Restore Verification Test
// Exercises the automated backup and restore flow and asserts 100% parity
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { runBackupAndRestoreVerification } from '../../scripts/backup_and_restore_verify';

describe('Milestone 9: Backup & Restore Verification', () => {
  it('performs clean database dump, isolated restore, and verifies 100% table row count parity', async () => {
    // This will throw if any table fails row count comparison
    await expect(runBackupAndRestoreVerification()).resolves.toBeUndefined();
  }, 30000); // 30s timeout for full dump and restore
});
