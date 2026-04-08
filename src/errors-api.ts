/**
 * Public error API for opencli plugins.
 *
 * TS plugins can import from '@jackwener/opencli/errors' to reuse the same
 * typed error classes and helpers as built-in adapters.
 */

export {
  AdapterLoadError,
  ArgumentError,
  AuthRequiredError,
  BrowserConnectError,
  CliError,
  CommandExecutionError,
  ConfigError,
  EmptyResultError,
  ERROR_ICONS,
  EXIT_CODES,
  SelectorError,
  TimeoutError,
  getErrorMessage,
} from './errors.js';
export type { BrowserConnectKind, ExitCode } from './errors.js';
