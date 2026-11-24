/**
 * scripts/seed_pilot_auth_users.cjs
 * Seeds or updates the 4 real role users in Supabase Auth (auth.users and auth.identities)
 * so that all 4 roles can log in with verified pilot credentials.
 */

const { Client } = require('pg');

const PILOT_USERS = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    email: 'ratnaraaj@yahoo.com',
    password: 'Starciti2026!Admin',
    name: 'M. Ratnaraj',
    role: 'admin',
    identityId: 'b9c5a82e-b082-46af-bce2-4d655b64e31d',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    email: 'operations@starciti.com',
    password: 'Starciti2026!Staff',
    name: 'Office Operations Staff',
    role: 'staff',
    identityId: 'b9c5a82e-b082-46af-bce2-4d655b64e32e',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    email: 'hemanth@starciti.com',
    password: 'Starciti2026!Driver',
    name: 'Hemanth Kumar',
    role: 'driver',
    identityId: 'b9c5a82e-b082-46af-bce2-4d655b64e33f',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    email: 'admin@vindhyatelelinks.com',
    password: 'Starciti2026!Client',
    name: 'VTL Billing Coordinator',
    role: 'customer_viewer',
    identityId: 'b9c5a82e-b082-46af-bce2-4d655b64e34a',
  },
];

async function seedAuthUsers() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54322,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  await client.connect();

  for (const u of PILOT_USERS) {
    const rawAppMeta = JSON.stringify({ provider: 'email', providers: ['email'] });
    const rawUserMeta = JSON.stringify({ name: u.name, role: u.role, email_verified: true });

    // Ensure pgcrypto extension is active
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // Upsert into auth.users
    const userQuery = `
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        $1,
        'authenticated', 'authenticated', $2,
        crypt($3, gen_salt('bf')),
        NOW(),
        $4::jsonb,
        $5::jsonb,
        NOW(), NOW(), false, false,
        '', '', '', '',
        '', '', '', ''
      )
      ON CONFLICT (id) DO UPDATE SET
        encrypted_password = crypt($3, gen_salt('bf')),
        email_confirmed_at = NOW(),
        raw_user_meta_data = $5::jsonb,
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '',
        phone_change = '',
        phone_change_token = '',
        email_change_token_current = '',
        reauthentication_token = '',
        updated_at = NOW();
    `;
    await client.query(userQuery, [u.id, u.email, u.password, rawAppMeta, rawUserMeta]);

    // Upsert into auth.identities
    const identQuery = `
      INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::text, $3::uuid,
        json_build_object('sub', $2::text, 'email', $4::text, 'email_verified', true)::jsonb,
        'email', NOW(), NOW()
      )
      ON CONFLICT (provider, provider_id) DO UPDATE SET
        identity_data = json_build_object('sub', $2::text, 'email', $4::text, 'email_verified', true)::jsonb,
        updated_at = NOW();
    `;
    await client.query(identQuery, [u.identityId, u.id, u.id, u.email]);
  }

  console.log('[PASS] All 4 pilot roles seeded in auth.users and auth.identities successfully.');
  await client.end();
}

seedAuthUsers().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
