import crypto from 'crypto';
import pg from 'pg';
const { Client } = pg;

// Supabase local stack secret
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function generateUserJwt(userId, email, role = 'authenticated') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: userId,
    email: email,
    role: role,
    app_metadata: { provider: 'email' },
    user_metadata: {},
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    payload,
  };
}

async function verify() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });
  await client.connect();

  console.log('Connected to real Supabase local PostgreSQL on port 54322!');

  const admin = generateUserJwt('c0000000-0000-0000-0000-000000000001', 'admin@starciti.com');
  const staff = generateUserJwt('c0000000-0000-0000-0000-000000000002', 'staff@starciti.com');
  const driver = generateUserJwt('c0000000-0000-0000-0000-000000000003', 'driver@starciti.com');

  // Verify decoded JWT with Supabase auth.uid() function
  await client.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify(admin.payload)]);
  const uidRes = await client.query('SELECT auth.uid() as uid');
  console.log('Real auth.uid() returns:', uidRes.rows[0].uid);

  // Check current role derivation
  const roleRes = await client.query('SELECT get_current_app_role() as role');
  console.log('Admin derived role from DB:', roleRes.rows[0].role);

  // Staff check
  await client.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify(staff.payload)]);
  const staffRoleRes = await client.query('SELECT get_current_app_role() as role');
  console.log('Staff derived role from DB:', staffRoleRes.rows[0].role);

  // Driver check
  await client.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify(driver.payload)]);
  const driverRoleRes = await client.query('SELECT get_current_app_role() as role');
  console.log('Driver derived role from DB:', driverRoleRes.rows[0].role);

  await client.end();
}

verify().catch(console.error);
