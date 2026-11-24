# Starciti Fleet & Billing Desk — Production Self-Hosted Deployment Guide

**Target Environment**: Windows PC Host with Docker Desktop  
**Stack**: Official Self-Hosted Supabase (PostgreSQL 17, GoTrue Auth, PostgREST, Storage API, Studio) + Nginx SPA Container + Cloudflare HTTPS Tunnel  
**Client**: Mr. M. Ratnaraj, Founder & Proprietor, M/S City Tours & Travels | Starciti Group, Trivandrum, Kerala

---

## 1. Architecture Overview

```
                      INTERNET / MOBILE CLIENTS
                                │
                                ▼
                   ┌─────────────────────────┐
                   │ Cloudflare Edge (HTTPS) │
                   └────────────┬────────────┘
                                │ Outbound Encrypted Tunnel (Zero Open Ports)
                                ▼
       ╔══════════════════════════════════════════════════╗
       ║             WINDOWS HOST PC (DOCKER)             ║
       ║                                                  ║
       ║   ┌──────────────────────────────────────────┐   ║
       ║   │      cloudflared Tunnel Container        │   ║
       ║   └────────────────────┬─────────────────────┘   ║
       ║                        ▼                         ║
       ║   ┌──────────────────────────────────────────┐   ║
       ║   │   Nginx Frontend Container (Port 8080)   │   ║
       ║   │   - Serves React SPA & Driver PWA        │   ║
       ║   │   - Proxies /auth, /rest, /storage       │   ║
       ║   └────────────────────┬─────────────────────┘   ║
       ║                        ▼                         ║
       ║   ┌──────────────────────────────────────────┐   ║
       ║   │       Kong API Gateway (Port 54321)      │   ║
       ║   └──────┬─────────────┼─────────────┬───────┘   ║
       ║          ▼             ▼             ▼           ║
       ║     ┌─────────┐   ┌─────────┐   ┌─────────┐      ║
       ║     │ GoTrue  │   │PostgREST│   │ Storage │      ║
       ║     │  Auth   │   │  (REST) │   │   API   │      ║
       ║     └────┬────┘   └────┬────┘   └────┬────┘      ║
       ║          │             │             │           ║
       ║          └─────────────┼─────────────┘           ║
       ║                        ▼                         ║
       ║   ┌──────────────────────────────────────────┐   ║
       ║   │    PostgreSQL 17 Container (Port 54322)  │   ║
       ║   │    - Bound strictly to 127.0.0.1         │   ║
       ║   │    - RLS Policies & Immutability Triggers│   ║
       ║   └──────────────────────────────────────────┘   ║
       ║                        ▲                         ║
       ║   ┌────────────────────┴─────────────────────┐   ║
       ║   │    Supabase Studio Dashboard (Port 54323) │   ║
       ║   │    - Bound strictly to 127.0.0.1         │   ║
       ║   └──────────────────────────────────────────┘   ║
       ╚══════════════════════════════════════════════════╝
```

---

## 2. Prerequisites on the Windows Host PC

1. **Windows 10 / 11 Pro or Home (64-bit)** with WSL2 enabled.
2. **Docker Desktop for Windows**:
   - In Settings > General: Check **"Start Docker Desktop when you log in"**.
   - Check **"Use the WSL 2 based engine"**.
3. **Node.js LTS (v20+)**: Installed on Windows host.
4. **Git**: Installed on Windows host.
5. **Secondary Backup Drive**: External HDD, USB drive, or partition `D:\StarcitiBackups`.

---

## 3. Step-by-Step Installation

### Step 3.1: Generate Strong Production Secrets
Run the automated secrets generator script:
```powershell
node scripts/setup_self_hosted_secrets.cjs
```
This generates:
- 32-byte cryptographically secure PostgreSQL password.
- 64-byte HMAC-SHA256 JWT secret.
- Cryptographically signed HS256 JWT for `anon` role (10-year validity).
- Cryptographically signed HS256 JWT for `service_role` role (10-year validity).
- AES-256 backup encryption key.
- Supabase Studio HTTP Basic Auth credentials.
- Stores them strictly inside `.env.production` (which is git-ignored).

### Step 3.2: Compile the Production Frontend
```powershell
npm install
npm run build
```
This compiles the optimized production bundle with service worker and offline IndexedDB queue into `dist/`.

### Step 3.3: Launch the Self-Hosted Docker Compose Stack
```powershell
docker compose up -d
```
Docker starts all 10 services with `restart: unless-stopped`.  
All database and microservice ports are bound strictly to `127.0.0.1` (localhost only).

### Step 3.4: Initialize the Fresh Production Database
Apply `scripts/fresh_production_database.sql` with real baseline masters and the dedicated `TEST` series:
```powershell
node scripts/init_production_database.cjs
```
This verifies:
- 2 Real Customers: M/s Vindhya Telelinks Limited & Global Public School.
- 4 Real Vehicles: `KL 01 CP 3284`, `KL 82 4889`, `KL 74 E 3694`, `KL 21 M 2378`.
- 4 Real Drivers: `Hemanth Kumar`, `Muhammad Fayaz.s`, `Asheerkhan`, `Afzal`.
- 0 Invoices & 0 Trip entries (pristine go-live baseline).
- Active `TEST` invoice series for safe pilot invoicing.

### Step 3.5: Run the Server Health Check
Verify all services are responding:
```powershell
node scripts/check_server_health.cjs
```

---

## 4. Cloudflare HTTPS Tunnel Setup

Zero router port forwarding is needed. Traffic is securely routed through Cloudflare's edge.

### Option A: Quick Tunnel (Instant 30-Second Setup, No Account Required)
```powershell
docker run --rm --network host cloudflare/cloudflared:latest tunnel --url http://127.0.0.1:8080
```
Cloudflare outputs a public HTTPS URL (e.g. `https://xxxx-xxxx.trycloudflare.com`).  
Open this link on any mobile phone or office computer.

### Option B: Named Production Tunnel (Your Custom Domain e.g. `erp.starciti.in`)
1. Log in to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks > Tunnels > Create a Tunnel**.
3. Choose **Cloudflared** > Name: `starciti-pc-host` > click **Save Tunnel**.
4. Copy your Tunnel Token (`eyJh...`) and paste it into `.env.production`:
   ```ini
   CLOUDFLARE_TUNNEL_TOKEN=eyJh...
   ```
5. In Cloudflare Dashboard, configure **Public Hostname**:
   - Subdomain: `erp`
   - Domain: `starciti.in`
   - Type: `HTTP`
   - URL: `frontend:80` (or `localhost:8080`)
6. Restart the Docker stack:
   ```powershell
   docker compose up -d
   ```
7. Visit `https://erp.starciti.in` from anywhere with automatic SSL!

---

## 5. Automated Backups & Monthly Drill

### Nightly Automation:
Run PowerShell as Administrator to register the 02:00 AM nightly backup:
```powershell
.\scripts\install_backup_task.ps1
```
Backups are dumped, checksummed, AES-256 encrypted, and copied to `D:\StarcitiBackups`.

### Monthly Restore Drill:
On the 1st of every month, run:
```powershell
node scripts/restore_production.cjs
```
The script decrypts, verifies the checksum, restores into `starciti_restore_drill`, and audits row counts.

---

## 6. Disaster Recovery & Runbooks

- Day-to-day operations: [docs/self_hosted_runbook.md](file:///e:/projects/starcity/docs/optional/self_hosted_runbook.md)
- Emergency laptop recovery in < 15 minutes: [docs/pc_down_disaster_recovery.md](file:///e:/projects/starcity/docs/optional/pc_down_disaster_recovery.md)
- Monthly restore calendar reminder: [docs/Starciti_Monthly_Backup_Drill.ics](file:///e:/projects/starcity/docs/optional/Starciti_Monthly_Backup_Drill.ics)

---

## 7. Future Production PC Automation Plan (When Production PC is Procured)

> **Note:** During the current phase on the DEV PC, these automation scripts are held in design. Once the physical production PC arrives, they will be generated and executed in this exact order:

1. **`scripts/make_release.ps1`**:
   - Generates a timestamped, versioned production release package (`starciti-release-vX.Y.Z.zip`).
   - Bundles the compiled production web build (`dist/`), official Docker compose definition, SQL schema migrations (`fresh_production_database.sql`), and environmental template.
   - Computes SHA-256 hash for release verification.

2. **`scripts/setup_production_pc.ps1`**:
   - One-shot initialization script executed on the new Windows production PC.
   - Configures Windows power settings (prevents sleep, enables auto-start after power loss in BIOS/OS).
   - Creates the local backup volume `D:\StarcitiBackups` with proper ACL permissions.
   - Installs and registers the Docker Compose service to auto-start with Windows (`restart: unless-stopped`).
   - Automatically applies `fresh_production_database.sql` to initialize schema, RLS, and clean real entities (0 sample rows).
   - Registers the 02:00 AM nightly backup scheduled task.

3. **`scripts/update_production.ps1` (Backup-First with Automatic Rollback)**:
   - **Step 1 (Mandatory Pre-Update Backup):** Executes an immediate `pg_dump` of the live production database and copies all storage assets before changing any files. If this pre-backup fails, the script aborts immediately.
   - **Step 2 (Safe Staged Deployment):** Pulls the new release, updates container images, and executes pending SQL migrations in a transaction.
   - **Step 3 (Automated Healthcheck):** Verifies frontend HTTP 200 response, database connectivity, and RLS check.
   - **Step 4 (Rollback Guard):** If the healthcheck fails, the script automatically restores the pre-update database dump and rolls back container versions, ensuring zero operational downtime.

4. **Production Version Badge**:
   - Unobtrusive version tag (e.g. `v1.0.0-prod`) displayed in the sidebar footer alongside the active Cloudflare tunnel status.

