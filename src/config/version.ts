/**
 * Application Version and Build Metadata
 * Starciti Fleet Desk - Small-Business Fleet & Contract Billing Engine
 */

export const APP_VERSION = '1.0.0';
export const APP_BUILD_DATE = '2026-11-24';
export const APP_BUILD_STAGE = 'Production Ready';
export const APP_NAME = 'Starciti Fleet Desk';

export interface VersionInfo {
  version: string;
  buildDate: string;
  stage: string;
  name: string;
}

export const getVersionInfo = (): VersionInfo => ({
  version: APP_VERSION,
  buildDate: APP_BUILD_DATE,
  stage: APP_BUILD_STAGE,
  name: APP_NAME,
});
