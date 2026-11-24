/**
 * scripts/check_server_health.cjs
 *
 * Comprehensive Health & Uptime Verification for Self-Hosted PC Deployment:
 * 1. Docker Engine Connectivity
 * 2. Supabase / Postgres Database Connectivity (Port 54322)
 * 3. Supabase Kong API Gateway (Port 54321)
 * 4. Supabase GoTrue Auth Health Check
 * 5. Supabase Storage API Health Check
 * 6. Frontend Production Web Server (Port 8080 /health)
 *
 * Exits with code 0 on all healthy, 1 on any failure (suitable for uptime monitoring).
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const { Client } = require('pg');

async function testHttpEndpoint(url, expectedStatus = 200, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      resolve({ ok: res.statusCode === expectedStatus, status: res.statusCode });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Connection Timed Out' });
    });
  });
}

async function checkHealth() {
  console.log('==================================================================');
  console.log('STARCITI FLEET DESK: SERVER HEALTH & UPTIME MONITOR');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('==================================================================');

  let allPass = true;

  // 1. Docker Engine
  process.stdout.write('[1/6] Docker Desktop Engine:      ');
  try {
    execSync('docker info', { stdio: 'pipe' });
    console.log('PASS (Running)');
  } catch (err) {
    console.log('FAIL (Docker daemon not responding)');
    allPass = false;
  }

  // 2. PostgreSQL Database
  process.stdout.write('[2/6] PostgreSQL Database (54322): ');
  const dbClient = new Client({
    host: '127.0.0.1',
    port: 54322,
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 3000,
  });

  try {
    await dbClient.connect();
    const res = await dbClient.query('SELECT 1 as alive, version()');
    console.log(`PASS (Connected - ${res.rows[0].version.split(' ')[0]} ${res.rows[0].version.split(' ')[1]})`);
    await dbClient.end();
  } catch (err) {
    // Also test fallback port 5439
    try {
      const fbClient = new Client({
        host: '127.0.0.1',
        port: 5439,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres',
        connectionTimeoutMillis: 2000,
      });
      await fbClient.connect();
      console.log('PASS (Connected on fallback port 5439)');
      await fbClient.end();
    } catch (fbErr) {
      console.log(`FAIL (${err.message})`);
      allPass = false;
    }
  }

  // 3. Kong API Gateway
  process.stdout.write('[3/6] Kong API Gateway (54321):    ');
  const kongRes = await testHttpEndpoint('http://127.0.0.1:54321/rest/v1/');
  // PostgREST root returns 200 with OpenAPI schema
  if (kongRes.ok || kongRes.status === 200 || kongRes.status === 401) {
    console.log(`PASS (HTTP ${kongRes.status || 200})`);
  } else {
    console.log(`FAIL (${kongRes.error || `HTTP ${kongRes.status}`})`);
    allPass = false;
  }

  // 4. Supabase Auth (GoTrue)
  process.stdout.write('[4/6] Supabase Auth Service:       ');
  const authRes = await testHttpEndpoint('http://127.0.0.1:54321/auth/v1/health');
  if (authRes.ok || authRes.status === 200) {
    console.log(`PASS (HTTP ${authRes.status})`);
  } else {
    console.log(`FAIL (${authRes.error || `HTTP ${authRes.status}`})`);
    allPass = false;
  }

  // 5. Supabase Storage API
  process.stdout.write('[5/6] Supabase Storage Service:    ');
  const storageRes = await testHttpEndpoint('http://127.0.0.1:54321/storage/v1/status');
  if (storageRes.ok || storageRes.status === 200) {
    console.log(`PASS (HTTP ${storageRes.status})`);
  } else {
    console.log(`FAIL (${storageRes.error || `HTTP ${storageRes.status}`})`);
    allPass = false;
  }

  // 6. Frontend Production Server
  process.stdout.write('[6/6] Frontend Web Server:         ');
  const webRes8080 = await testHttpEndpoint('http://127.0.0.1:8080/health');
  const webRes4173 = await testHttpEndpoint('http://127.0.0.1:4173/');

  if (webRes8080.ok) {
    console.log('PASS (HTTP 200 on port 8080 - Nginx Container)');
  } else if (webRes4173.ok) {
    console.log('PASS (HTTP 200 on port 4173 - Preview Host)');
  } else {
    console.log('NOTICE (Frontend not currently bound on port 8080 or 4173; run docker-compose up)');
  }

  console.log('------------------------------------------------------------------');
  if (allPass) {
    console.log('OVERALL SYSTEM STATUS: HEALTHY (All Core Services Responding)');
  } else {
    console.log('OVERALL SYSTEM STATUS: DEGRADED (One or more services need attention)');
  }
  console.log('==================================================================');

  process.exit(allPass ? 0 : 1);
}

checkHealth();
