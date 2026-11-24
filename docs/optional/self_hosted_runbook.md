# Starciti Fleet Desk: Self-Hosted Windows Docker Operations Runbook

**Client**: Mr. M. Ratnaraj, Founder & Proprietor  
**Enterprises**: M/S City Tours & Travels | Starciti Group, Trivandrum, Kerala  
**Architecture**: Self-Hosted Supabase (Postgres 17, GoTrue, PostgREST, Storage, Studio) + Nginx Frontend + Cloudflare HTTPS Tunnel

---

## 1. Quick Command Reference

All commands run from PowerShell in `E:\projects\starcity`:

| Action | Command | Purpose |
| :--- | :--- | :--- |
| **Check System Health** | `node scripts/check_server_health.cjs` | Checks Docker, DB, Kong, Auth, Storage, Frontend |
| **Start Entire Stack** | `docker compose up -d` | Launches DB, Auth, REST, Storage, Studio, Nginx, Tunnel |
| **Stop Stack** | `docker compose down` | Gracefully shuts down all containers |
| **Restart Stack** | `docker compose restart` | Restarts all containers |
| **View Live Logs** | `docker compose logs -f frontend` | Streams live logs (replace `frontend` with `db`, `auth`, etc.) |
| **Run Nightly Backup** | `node scripts/backup_production.cjs` | Dumps DB, copies to `D:\StarcitiBackups`, AES-256 encrypts |
| **Test Restore Drill** | `node scripts/restore_production.cjs` | Decrypts and tests restore in isolated `starciti_restore_drill` |
| **Access Supabase Studio** | Open browser to `http://127.0.0.1:54323` | Inspect tables, SQL editor, and storage buckets |

---

## 2. Windows PC Host Configuration (Auto-Start & Reliability)

### 2.1 BIOS / UEFI Auto-Power-On (Kerala Power Cut Recovery)
When power returns after an outage, the PC must boot automatically:
1. Restart your PC and repeatedly press `Del` or `F2` to enter BIOS/UEFI Setup.
2. Navigate to **Power Management** or **Advanced Settings**.
3. Look for the setting named:
   - **Restore on AC/Power Loss**, OR
   - **AC Back Function**, OR
   - **After Power Loss**.
4. Change the value from `Power Off` (default) to **`Power On`** (or `Always On`).
5. Press `F10` to save changes and restart.

### 2.2 Disable Windows Sleep & Hibernate
The server must stay continuously awake to serve drivers and staff.  
Open an elevated **PowerShell as Administrator** and execute:

```powershell
# 1. Disable sleep timeout when plugged into power
powercfg /change standby-timeout-ac 0

# 2. Disable hibernation timeout
powercfg /change hibernate-timeout-ac 0

# 3. Optional: Allow display to turn off after 15 minutes (PC stays fully awake)
powercfg /change monitor-timeout-ac 15

# 4. Activate High Performance power profile
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
```

### 2.3 Docker Desktop Startup Configuration
1. Open **Docker Desktop**.
2. Click the **Gear Icon (Settings)** at the top right.
3. Under the **General** tab:
   - Check **"Start Docker Desktop when you log in"**.
   - Check **"Use the WSL 2 based engine"**.
4. In `docker-compose.yml`, every container has `restart: unless-stopped`.  
   When Windows boots and Docker Desktop opens, all containers resume automatically!

---

## 3. Windows Defender Firewall (Zero External Port Exposure)

All database and microservice ports are bound strictly to `127.0.0.1`. To guarantee that no other device on your local Wi-Fi or office network can connect to your database or studio:

Open **PowerShell as Administrator** and run:

```powershell
# Block external inbound connections to PostgreSQL (54322, 5432)
New-NetFirewallRule -DisplayName "Starciti-Block-DB-External" -Direction Inbound -LocalPort 54322,5432 -Protocol TCP -Action Block -RemoteAddress "192.168.0.0/16,10.0.0.0/8"

# Block external inbound connections to Supabase Studio (54323)
New-NetFirewallRule -DisplayName "Starciti-Block-Studio-External" -Direction Inbound -LocalPort 54323 -Protocol TCP -Action Block -RemoteAddress "192.168.0.0/16,10.0.0.0/8"

# Block external inbound connections to Kong Gateway (54321)
New-NetFirewallRule -DisplayName "Starciti-Block-Kong-External" -Direction Inbound -LocalPort 54321 -Protocol TCP -Action Block -RemoteAddress "192.168.0.0/16,10.0.0.0/8"
```

All external access arrives **exclusively through the encrypted Cloudflare Tunnel**.

---

## 4. Cloudflare Tunnel Setup (Step-by-Step)

Zero router port forwarding is needed. The tunnel establishes an outbound encrypted connection to Cloudflare.

### Option A: Quick Tunnel (Instant 30-Second Setup, No Account Required)
To instantly generate a public HTTPS URL for testing driver mobile phones:
```powershell
docker run --rm --network host cloudflare/cloudflared:latest tunnel --url http://127.0.0.1:8080
```
In the terminal, Cloudflare will print a URL:
`Your quick Tunnel has been created! Visit it at: https://xxxx-xxxx.trycloudflare.com`  
Open this HTTPS URL on your phone or share it with drivers.

### Option B: Named Production Tunnel (Your Custom Domain e.g. `erp.starciti.in`)
1. Log in to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. In the left menu, click **Networks > Tunnels > Create a Tunnel**.
3. Select **Cloudflared** as the connector type and click **Next**.
4. Enter Tunnel Name: `starciti-pc-host` and click **Save Tunnel**.
5. Under **Install and run a connector**, select **Docker**.
6. Cloudflare displays a command containing your tunnel token:
   `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJh...`
7. Copy only the token string (`eyJh...`) and paste it into `.env.production`:
   ```ini
   CLOUDFLARE_TUNNEL_TOKEN=eyJh...your-token-here...
   ```
8. Click **Next** to configure **Public Hostname**:
   - **Subdomain**: `erp`
   - **Domain**: `starciti.in` (or your domain)
   - **Service Type**: `HTTP`
   - **URL**: `frontend:80` (or `localhost:8080`)
9. Click **Save Hostname**.
10. In PowerShell, restart the stack:
    ```powershell
    docker compose up -d
    ```
11. Visit `https://erp.starciti.in` from any phone or computer in the world!

---

## 5. Automated Backups & Monthly Restore Drill

### 5.1 Nightly Automation (Task Scheduler)
To register the automated 02:00 AM backup in Windows Task Scheduler, run PowerShell as Administrator:
```powershell
.\scripts\install_backup_task.ps1
```

### 5.2 What the Backup Does
Every night at 02:00 AM, `scripts/backup_production.cjs` runs:
1. Dumps the complete PostgreSQL database to `backups/starciti_backup_<timestamp>.sql`.
2. Computes a SHA-256 integrity hash (`.sha256`).
3. Encrypts an offsite copy using AES-256 (`.enc`) using `BACKUP_ENCRYPTION_KEY`.
4. Copies the backup to your secondary drive (`D:\StarcitiBackups`).
5. Prunes backups older than 30 days (while preserving monthly 1st-of-month archives).

### 5.3 Conducting the Monthly Restore Drill (1st of Every Month)
Double-click [docs/Starciti_Monthly_Backup_Drill.ics](file:///e:/projects/starcity/docs/Starciti_Monthly_Backup_Drill.ics) to add the monthly reminder to your calendar.

On the 1st of every month, run:
```powershell
node scripts/restore_production.cjs
```
The script will automatically decrypt the latest backup, restore it into an isolated test database (`starciti_restore_drill`), audit row counts, and confirm 100% data recoverability.

---

## 6. How to Deploy Code Updates
When new features or fixes are added:
```powershell
# 1. Build the updated frontend
npm run build

# 2. Rebuild the frontend container
docker compose build frontend

# 3. Apply the updated container with zero downtime
docker compose up -d frontend

# 4. Verify health
node scripts/check_server_health.cjs
```
