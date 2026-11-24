# Starciti Fleet Desk: "PC is Down" Disaster Recovery Runbook

**Client**: Mr. M. Ratnaraj, Founder & Proprietor  
**Enterprises**: M/S City Tours & Travels | Starciti Group, Trivandrum, Kerala  
**Recovery Target**: RTO < 15 Minutes | RPO < 24 Hours (Nightly Backup)

---

## 1. Scenario: What If My PC Hardware Dies or Won't Boot?

If the primary Windows PC suffers hardware failure (power surge, motherboard failure, drive crash) or Windows fails to boot:

> [!IMPORTANT]
> **Your business does NOT stop.**
> 1. **Driver App Continues Offline**: Drivers can continue entering start/closing km, times, and capturing odometer photos on their mobile phones. The driver PWA saves everything locally to IndexedDB and queues it for automatic sync.
> 2. **Offsite & Secondary Backups Exist**: Every night at 02:00 AM, an automated AES-256 encrypted backup is copied to your secondary drive (`D:\StarcitiBackups`) and synced offsite.
> 3. **Any Laptop Can Become the Server**: You can restore the entire ERP on any laptop or desktop with Docker Desktop in under 15 minutes.

---

## 2. Emergency Recovery Steps (15-Minute Restore on Any Laptop)

### Step 1: Prepare the Replacement Laptop
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on the replacement computer.
2. Install [Node.js (LTS)](https://nodejs.org/).
3. Copy the project folder `starcity` from your backup USB or clone it from git.

### Step 2: Retrieve the Latest Encrypted Backup
Retrieve the latest `.enc` file and your `.env.production` from:
- Secondary disk (`D:\StarcitiBackups`), OR
- Your USB flash drive, OR
- Your offsite cloud backup (Google Drive / Cloudflare R2).

Place:
- `.env.production` in the project root: `E:\projects\starcity\.env.production` (or replacement folder).
- `starciti_backup_*.enc` in: `E:\projects\starcity\backups\`.

### Step 3: Launch the Replacement Docker Stack
Open PowerShell inside the project directory and run:
```powershell
# Build and start all Supabase microservices and Nginx frontend
docker compose up -d
```
Wait 30 seconds for PostgreSQL and Kong Gateway to report healthy.

### Step 4: Restore All Database Records & Storage
Run the automated restore script with explicit production confirmation:
```powershell
node scripts/restore_production.cjs --target=postgres --confirm=YES_RESTORE_PRODUCTION
```

The script will automatically:
1. Detect your latest `.enc` backup.
2. Decrypt it using the `BACKUP_ENCRYPTION_KEY` in `.env.production`.
3. Verify the SHA-256 checksum to guarantee zero file tampering.
4. Restore all tables, RLS policies, users, invoices, and trips into PostgreSQL.
5. Print a table count audit confirming 100% data recovery.

### Step 5: Reconnect Drivers and Staff via Cloudflare Tunnel
1. If using **Option A (Instant Quick Tunnel)**:
   ```powershell
   docker run --rm --network host cloudflare/cloudflared:latest tunnel --url http://127.0.0.1:8080
   ```
   Share the generated `https://xxxx.trycloudflare.com` URL with staff and drivers.

2. If using **Option B (Named Production Domain e.g. `erp.starciti.in`)**:
   - The `cloudflared` container in `docker-compose.yml` connects automatically using your `CLOUDFLARE_TUNNEL_TOKEN`.
   - Your public domain `https://erp.starciti.in` immediately switches traffic to the new laptop with **zero DNS changes required**!

### Step 6: Sync Drivers' Queued Offline Trips
Instruct drivers to open their mobile app. A banner will appear:  
`"Server back online. 3 pending offline trips ready to sync."`  
Drivers tap **"Sync Now"** and all pending trips, odometer readings, and captured photos sync into PostgreSQL with zero data loss.

---

## 3. Disaster Recovery Checklist & Contact Protocol

| Item | Location / Action | Verification Frequency |
| :--- | :--- | :--- |
| **Secondary Backup Drive** | External HDD / USB Drive (`D:\StarcitiBackups`) | Checked Daily |
| **Encryption Key** | `BACKUP_ENCRYPTION_KEY` written in paper safe / password manager | Verified Monthly |
| **Cloudflare Token** | `CLOUDFLARE_TUNNEL_TOKEN` saved securely | Verified on Setup |
| **Restore Drill** | Run `node scripts/restore_production.cjs` in drill mode | **1st of Every Month** |
