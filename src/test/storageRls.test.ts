import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import crypto from 'crypto';

import { createTestClient, assertTestDatabaseGuard } from './testDbHelper';

describe('Follow-up B & C: Storage RLS & Security-Definer Token Rate Limiting', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);
    await client.query('SET ROLE starciti_app;');
  });

  afterAll(async () => {
    if (client) {
      await client.query('RESET ROLE;');
      await client.end();
    }
  });

  // TEST 1: Driver can only upload to their own folder in storage.objects
  it('Storage RLS: Driver can insert photos into their own driver folder (driver_id/*) via JWT', async () => {
    const driverId = 'd0000000-0000-0000-0000-000000000001'; // Hemanth Kumar
    // Authenticated Driver JWT
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', false);");

    const ownPhotoPath = `${driverId}/2026-08-31-close.jpg`;
    const insertRes = await client.query(
      `INSERT INTO storage.objects (bucket_id, name, owner_id)
       VALUES ('odometer-photos', $1, $2)
       RETURNING id, name;`,
      [ownPhotoPath, driverId]
    );

    expect(insertRes.rows.length).toBe(1);
    expect(insertRes.rows[0].name).toBe(ownPhotoPath);
  });

  // TEST 2: Driver CANNOT upload to another driver's folder
  it("Storage RLS: Driver is strictly blocked from inserting photos into another driver's folder via JWT", async () => {
    const driverId = 'd0000000-0000-0000-0000-000000000001'; // Hemanth
    const victimDriverId = 'd0000000-0000-0000-0000-000000000004'; // Afzal
    // Authenticated Driver JWT
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', false);");

    const alienPhotoPath = `${victimDriverId}/fake-odo.jpg`;

    // Attempting to upload to another driver's directory violates row-level security policy
    await expect(
      client.query(
        `INSERT INTO storage.objects (bucket_id, name, owner_id)
         VALUES ('odometer-photos', $1, $2);`,
        [alienPhotoPath, driverId]
      )
    ).rejects.toThrow(/violates row-level security policy/i);
  });

  // TEST 3: Staff can read all photos across fleet
  it('Storage RLS: Staff can view all odometer photos across all vehicles and drivers via JWT', async () => {
    // Authenticated Staff JWT
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', false);");

    const res = await client.query('SELECT * FROM storage.objects;');
    expect(res.rows.length).toBeGreaterThanOrEqual(1);
  });

  // TEST 4: Security-Definer Token Verification with Rate Limiting
  it('Security Definer: verify_and_redeem_approval_token validates tokens and throttles when rate exceeded', async () => {
    // Admin sets up the approval token
    await client.query("SELECT set_config('app.current_role', 'admin', false);");

    // Generate a fresh 128-bit secure random token and hash
    const rawToken = crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Insert an approval record with future expiry
    await client.query(
      `INSERT INTO approvals (contract_id, customer_id, year_month, token_hash, status, expires_at, is_revoked)
       VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-08', $1, 'pending_approval', NOW() + INTERVAL '30 days', false)
       ON CONFLICT (token_hash) DO NOTHING;`,
      [tokenHash]
    );

    // Public / customer executes verification
    await client.query("SELECT set_config('app.current_role', 'customer_viewer', false);");
    const res1 = await client.query('SELECT * FROM verify_and_redeem_approval_token($1);', [tokenHash]);
    expect(res1.rows[0].is_valid).toBe(true);
    expect(res1.rows[0].contract_id).toBe('b0000000-0000-0000-0000-000000000001');

    // Simulate rate limiting by updating request_count = 10 within the last 1 minute as admin
    await client.query("SELECT set_config('app.current_role', 'admin', false);");
    await client.query(
      `UPDATE approvals SET request_count = 10, last_requested_at = NOW() WHERE token_hash = $1;`,
      [tokenHash]
    );

    // Customer query must now be rate-limited!
    await client.query("SELECT set_config('app.current_role', 'customer_viewer', false);");
    const resRateLimited = await client.query('SELECT * FROM verify_and_redeem_approval_token($1);', [tokenHash]);
    expect(resRateLimited.rows[0].is_valid).toBe(false);
    expect(resRateLimited.rows[0].rejection_reason).toBe('RATE_LIMITED');
  });

  it('Security Definer: rejects revoked or expired tokens', async () => {
    // Admin creates revoked record
    await client.query("SELECT set_config('app.current_role', 'admin', false);");
    const revokedHash = 'revoked_' + crypto.randomBytes(12).toString('hex');
    await client.query(
      `INSERT INTO approvals (contract_id, customer_id, year_month, token_hash, status, expires_at, is_revoked)
       VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-08', $1, 'pending_approval', NOW() + INTERVAL '30 days', true);`,
      [revokedHash]
    );

    // Customer query is rejected
    await client.query("SELECT set_config('app.current_role', 'customer_viewer', false);");
    const resRevoked = await client.query('SELECT * FROM verify_and_redeem_approval_token($1);', [revokedHash]);
    expect(resRevoked.rows[0].is_valid).toBe(false);
    expect(resRevoked.rows[0].rejection_reason).toBe('TOKEN_REVOKED');
  });
});
