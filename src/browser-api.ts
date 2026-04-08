/**
 * Public browser runtime API for opencli plugins.
 *
 * TS plugins can import from '@jackwener/opencli/browser' when they need the
 * daemon-backed Page implementation or direct daemon commands.
 */

export { Page } from './browser/page.js';
export {
  fetchDaemonStatus,
  isDaemonRunning,
  isExtensionConnected,
  listSessions,
  requestDaemonShutdown,
  sendCommand,
} from './browser/daemon-client.js';
export type {
  DaemonCommand,
  DaemonResult,
  DaemonStatus,
} from './browser/daemon-client.js';
