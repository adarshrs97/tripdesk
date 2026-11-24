import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { APP_VERSION, APP_BUILD_DATE, APP_BUILD_STAGE, getVersionInfo } from '../config/version';

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('M11: Release Preparation, Version Badge & Go-Live Checklist', () => {
  it('1. Version configuration matches package.json and provides build metadata', () => {
    const packageJsonPath = path.join(ROOT_DIR, 'package.json');
    expect(fs.existsSync(packageJsonPath)).toBe(true);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_BUILD_DATE).toBeDefined();
    expect(APP_BUILD_STAGE).toBe('Production Ready');

    const info = getVersionInfo();
    expect(info.version).toBe(packageJson.version);
    expect(info.name).toBe('Starciti Fleet Desk');
  });

  it('2. Header and Sidebar layout components include version badge', () => {
    const headerPath = path.join(ROOT_DIR, 'src', 'components', 'layout', 'Header.tsx');
    const sidebarPath = path.join(ROOT_DIR, 'src', 'components', 'layout', 'Sidebar.tsx');

    expect(fs.existsSync(headerPath)).toBe(true);
    expect(fs.existsSync(sidebarPath)).toBe(true);

    const headerContent = fs.readFileSync(headerPath, 'utf-8');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

    // Header badge
    expect(headerContent).toContain('APP_VERSION');
    expect(headerContent).toContain('header-version-badge');
    expect(headerContent).toContain('v{APP_VERSION}');

    // Sidebar badge
    expect(sidebarContent).toContain('APP_VERSION');
    expect(sidebarContent).toContain('sidebar-version-badge');
    expect(sidebarContent).toContain('v{APP_VERSION}');
  });

  it('3. make_release scripts exist for PowerShell and Bash with clean build flow', () => {
    const ps1Path = path.join(ROOT_DIR, 'scripts', 'make_release.ps1');
    const shPath = path.join(ROOT_DIR, 'scripts', 'make_release.sh');

    expect(fs.existsSync(ps1Path)).toBe(true);
    expect(fs.existsSync(shPath)).toBe(true);

    const ps1Content = fs.readFileSync(ps1Path, 'utf-8');
    const shContent = fs.readFileSync(shPath, 'utf-8');

    // Both scripts must run npm run build and docker build
    expect(ps1Content).toContain('npm run build');
    expect(ps1Content).toContain('docker build');
    expect(ps1Content).toContain('starciti-fleet-frontend');
    expect(ps1Content).toContain('release-manifest.json');

    expect(shContent).toContain('npm run build');
    expect(shContent).toContain('docker build');
    expect(shContent).toContain('starciti-fleet-frontend');
    expect(shContent).toContain('release-manifest.json');
  });

  it('4. update_system scripts and update_production.cjs enforce backup-first, migration, restart, health check & rollback', () => {
    const ps1Path = path.join(ROOT_DIR, 'scripts', 'update_system.ps1');
    const shPath = path.join(ROOT_DIR, 'scripts', 'update_system.sh');
    const cjsPath = path.join(ROOT_DIR, 'scripts', 'update_production.cjs');

    expect(fs.existsSync(ps1Path)).toBe(true);
    expect(fs.existsSync(shPath)).toBe(true);
    expect(fs.existsSync(cjsPath)).toBe(true);

    const cjsContent = fs.readFileSync(cjsPath, 'utf-8');

    // 1. Pre-update backup
    expect(cjsContent).toContain('Taking Pre-Update Database Backup');
    expect(cjsContent).toContain('pre_update_');

    // 2. Database migrations
    expect(cjsContent).toContain('Applying Pending Database Migrations');
    expect(cjsContent).toContain('_applied_migrations');

    // 3. Rebuild / restart service
    expect(cjsContent).toContain('Rebuilding and Restarting Frontend Service');
    expect(cjsContent).toContain('docker compose');

    // 4. Healthcheck
    expect(cjsContent).toContain('/health');
    expect(cjsContent).toContain('Post-Update Health Status');

    // 5. Rollback on failure
    expect(cjsContent).toContain('triggerRollback');
    expect(cjsContent).toContain('[ROLLBACK TRIGGERED]');
    expect(cjsContent).toContain('Restoring database from');
  });

  it('5. GoLiveChecklist includes all 7 owner-required input categories with bilingual guidance', () => {
    const checklistPath = path.join(ROOT_DIR, 'src', 'components', 'settings', 'GoLiveChecklist.tsx');
    expect(fs.existsSync(checklistPath)).toBe(true);

    const content = fs.readFileSync(checklistPath, 'utf-8');

    // 1. Invoice numbers
    expect(content).toContain('Starting Invoice Numbers');
    expect(content).toContain('TEST-SC-0001');
    expect(content).toContain('TEST-CTT-0001');

    // 2. Banking & UPI
    expect(content).toContain('Bank Accounts, IFSC & Dynamic UPI QR Details');
    expect(content).toContain('UPI ID / VPA');

    // 3. GST & Taxes
    expect(content).toContain('GSTIN Registration Numbers');
    expect(content).toContain('Confirm with CA');

    // 4. Logos & Signatures
    expect(content).toContain('Official Company Logos');
    expect(content).toContain('letterhead logo');

    // 5. Terms & Jurisdiction
    expect(content).toContain('Invoice Payment Terms & Legal Jurisdiction Text');
    expect(content).toContain('Thiruvananthapuram jurisdiction');

    // 6. Driver contacts & phone logins
    expect(content).toContain('Driver WhatsApp Mobile Numbers');
    expect(content).toContain('Hemanth');

    // 7. Domain & Cloudflare tunnel
    expect(content).toContain('Cloudflare Tunnel Token');
    expect(content).toContain('TUNNEL_TOKEN');

    // Malayalam translation support
    expect(content).toContain('ഇൻവോയ്സ് നമ്പറുകൾ');
    expect(content).toContain('ബാങ്ക് അക്കൗണ്ട്');
  });

  it('6. SettingsManager integrates Go-live checklist tab prominently', () => {
    const settingsPath = path.join(ROOT_DIR, 'src', 'components', 'settings', 'SettingsManager.tsx');
    expect(fs.existsSync(settingsPath)).toBe(true);

    const content = fs.readFileSync(settingsPath, 'utf-8');
    expect(content).toContain('GoLiveChecklist');
    expect(content).toContain('Go-live checklist');
    expect(content).toContain("activeTab === 'golive'");
  });
});
