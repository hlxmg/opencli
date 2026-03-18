import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'feishu',
  name: 'status',
  description: 'Check if Feishu (Lark) Desktop App is running on macOS',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    try {
      const output = execSync("osascript -e 'application \"Lark\" is running'", { encoding: 'utf-8' }).trim();
      return [{ Status: output === 'true' ? 'Running' : 'Stopped' }];
    } catch {
      return [{ Status: 'Error querying application state' }];
    }
  },
});
