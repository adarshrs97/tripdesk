/**
 * scripts/setup_self_hosted_secrets.cjs
 *
 * Generates cryptographically secure production secrets for the self-hosted Supabase stack:
 * - High-entropy Database Password (32 bytes hex)
 * - HMAC-SHA256 JWT Secret (64 bytes hex)
 * - Valid Signed HS256 JWT for anon role
 * - Valid Signed HS256 JWT for service_role
 * - AES-256 Backup Encryption Key (32 bytes hex)
 * - Realtime Encryption Key (16 bytes hex)
 * - Supabase Studio Dashboard Basic Auth Password
 *
 * Strictly ensures all secrets are stored only in git-ignored .env files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PROD_PATH = path.join(ROOT_DIR, '.env.production');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.production.example');
const GITIGNORE_PATH = path.join(ROOT_DIR, '.gitignore');

function signHS256Jwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

function generateSecrets(force = false) {
  console.log('==================================================================');
  console.log('STARCITI FLEET DESK: SELF-HOSTED SUPABASE SECRETS GENERATOR');
  console.log('==================================================================');

  if (fs.existsSync(ENV_PROD_PATH) && !force) {
    console.log(`[WARN] .env.production already exists at: ${ENV_PROD_PATH}`);
    console.log('To rotate secrets and overwrite, run with: node scripts/setup_self_hosted_secrets.cjs --force');
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const tenYearsExp = now + (10 * 365 * 24 * 3600); // Valid for 10 years

  const postgresPassword = crypto.randomBytes(32).toString('hex');
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  const backupEncryptionKey = crypto.randomBytes(32).toString('hex');
  const realtimeEncKey = crypto.randomBytes(16).toString('hex');
  const studioPassword = crypto.randomBytes(16).toString('base64url');

  const anonKey = signHS256Jwt({
    role: 'anon',
    iss: 'supabase',
    iat: now,
    exp: tenYearsExp,
  }, jwtSecret);

  const serviceRoleKey = signHS256Jwt({
    role: 'service_role',
    iss: 'supabase',
    iat: now,
    exp: tenYearsExp,
  }, jwtSecret);

  const envContent = `# ==============================================================================
# STARCITI FLEET DESK - PRODUCTION ENVIRONMENT SECRETS (SELF-HOSTED DOCKER)
# GENERATED ON: ${new Date().toISOString()}
# SECURITY WARNING: DO NOT COMMIT THIS FILE TO VERSION CONTROL
# ==============================================================================

# Database & Engine
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=postgres
POSTGRES_PORT=54322
DB_HOST=127.0.0.1

# Supabase Auth & JWT
JWT_SECRET=${jwtSecret}
JWT_EXPIRY=3600
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceRoleKey}

# Supabase Studio Dashboard Access
STUDIO_PORT=54323
STUDIO_USERNAME=admin
STUDIO_PASSWORD=${studioPassword}

# Realtime & Storage
REALTIME_ENC_KEY=${realtimeEncKey}
STORAGE_S3_KEY=starciti_storage_admin
STORAGE_S3_SECRET=${crypto.randomBytes(32).toString('hex')}

# Ports (Strictly bound to 127.0.0.1 on Windows Host)
KONG_HTTP_PORT=54321
FRONTEND_PORT=8080

# Cloudflare Tunnel Configuration
# (Paste your named Cloudflare Tunnel token here when setting up cloudflared service)
CLOUDFLARE_TUNNEL_TOKEN=

# Frontend Environment Variables (Vite Client Build)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=${anonKey}

# Backup & Disaster Recovery
BACKUP_DIR=./backups
BACKUP_DIR_SECONDARY=D:\\StarcitiBackups
BACKUP_ENCRYPTION_KEY=${backupEncryptionKey}
`;

  fs.writeFileSync(ENV_PROD_PATH, envContent, 'utf-8');
  console.log(`[PASS] Production secrets successfully written to: ${ENV_PROD_PATH}`);

  // Create sanitized template example
  const exampleContent = `# ==============================================================================
# STARCITI FLEET DESK - PRODUCTION ENVIRONMENT TEMPLATE (.env.production.example)
# Copy this to .env.production or run: node scripts/setup_self_hosted_secrets.cjs
# ==============================================================================

# Database & Engine
POSTGRES_PASSWORD=generate_with_crypto_random_bytes_32_hex
POSTGRES_DB=postgres
POSTGRES_PORT=54322
DB_HOST=127.0.0.1

# Supabase Auth & JWT
JWT_SECRET=generate_with_crypto_random_bytes_64_hex
JWT_EXPIRY=3600
ANON_KEY=valid_hs256_signed_jwt_for_role_anon
SERVICE_ROLE_KEY=valid_hs256_signed_jwt_for_role_service_role

# Supabase Studio Dashboard Access
STUDIO_PORT=54323
STUDIO_USERNAME=admin
STUDIO_PASSWORD=generate_random_alphanumeric_password

# Realtime & Storage
REALTIME_ENC_KEY=generate_with_crypto_random_bytes_16_hex
STORAGE_S3_KEY=starciti_storage_admin
STORAGE_S3_SECRET=generate_with_crypto_random_bytes_32_hex

# Ports (Strictly bound to 127.0.0.1 on Windows Host)
KONG_HTTP_PORT=54321
FRONTEND_PORT=8080

# Cloudflare Tunnel Configuration
CLOUDFLARE_TUNNEL_TOKEN=

# Frontend Environment Variables (Vite Client Build)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=same_as_ANON_KEY_above

# Backup & Disaster Recovery
BACKUP_DIR=./backups
BACKUP_DIR_SECONDARY=D:\\StarcitiBackups
BACKUP_ENCRYPTION_KEY=generate_with_crypto_random_bytes_32_hex
`;

  fs.writeFileSync(ENV_EXAMPLE_PATH, exampleContent, 'utf-8');
  console.log(`[PASS] Clean template written to: ${ENV_EXAMPLE_PATH}`);

  // Verify .gitignore coverage
  if (fs.existsSync(GITIGNORE_PATH)) {
    const gitignore = fs.readFileSync(GITIGNORE_PATH, 'utf-8');
    if (!gitignore.includes('.env.production')) {
      fs.appendFileSync(GITIGNORE_PATH, '\n.env.production\n');
      console.log('[PASS] Added .env.production to .gitignore');
    } else {
      console.log('[PASS] .gitignore already contains .env.production');
    }
  }

  console.log('------------------------------------------------------------------');
  console.log('SECRETS SUMMARY:');
  console.log(`- Database Port: 54322 (localhost only)`);
  console.log(`- Studio Port: 54323 (localhost only)`);
  console.log(`- Studio Username: admin`);
  console.log(`- Studio Password: ${studioPassword}`);
  console.log(`- Backup Key: ${backupEncryptionKey.substring(0, 8)}... (AES-256)`);
  console.log('==================================================================');
}

const isForce = process.argv.includes('--force');
generateSecrets(isForce);
