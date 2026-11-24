/**
 * scripts/verify_auth_logins.cjs
 * Verifies that all 4 roles can authenticate via real Supabase Auth
 * and resolve their expected permissions from public.app_users.
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = {};
fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const users = [
  { email: 'ratnaraaj@yahoo.com', pass: 'Starciti2026!Admin', expectedRole: 'admin' },
  { email: 'operations@starciti.com', pass: 'Starciti2026!Staff', expectedRole: 'staff' },
  { email: 'hemanth@starciti.com', pass: 'Starciti2026!Driver', expectedRole: 'driver' },
  { email: 'admin@vindhyatelelinks.com', pass: 'Starciti2026!Client', expectedRole: 'customer_viewer' },
];

async function verifyLogins() {
  console.log('Verifying Supabase Auth logins for all 4 roles...');
  let allPassed = true;

  for (const u of users) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: u.email,
      password: u.pass,
    });

    if (error) {
      console.error(`[FAIL] Login failed for ${u.email}:`, error.message);
      allPassed = false;
      continue;
    }

    const { data: dbUser, error: dbError } = await supabase
      .from('app_users')
      .select('role, name, is_active')
      .eq('email', u.email)
      .single();

    if (dbError || !dbUser) {
      console.error(`[FAIL] Could not fetch app_users record for ${u.email}:`, dbError?.message);
      allPassed = false;
      continue;
    }

    if (dbUser.role !== u.expectedRole) {
      console.error(`[FAIL] Role mismatch for ${u.email}: expected ${u.expectedRole}, got ${dbUser.role}`);
      allPassed = false;
      continue;
    }

    console.log(`[PASS] ${u.email} authenticated successfully. ID: ${data.user.id} | Role: ${dbUser.role} (${dbUser.name}) | Active: ${dbUser.is_active}`);
  }

  if (!allPassed) {
    process.exit(1);
  }
}

verifyLogins().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
