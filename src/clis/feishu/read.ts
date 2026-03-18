import { execSync, spawnSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const readCommand = cli({
  site: 'feishu',
  name: 'read',
  description: 'Copy recent messages from the active Feishu conversation (Cmd+A → Cmd+C)',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Content'],
  func: async (page: IPage | null) => {
    try {
      let clipBackup = '';
      try { clipBackup = execSync('pbpaste', { encoding: 'utf-8' }); } catch {}

      spawnSync('pbcopy', { input: '__OPENCLI_EMPTY__' });

      execSync("osascript -e 'tell application \"Lark\" to activate'");
      execSync("osascript -e 'delay 0.3'");

      const cmd = "osascript " +
                  "-e 'tell application \"System Events\"' " +
                  "-e 'keystroke \"a\" using command down' " +
                  "-e 'delay 0.2' " +
                  "-e 'keystroke \"c\" using command down' " +
                  "-e 'end tell'";
      execSync(cmd);
      execSync("osascript -e 'delay 0.3'");

      const result = execSync('pbpaste', { encoding: 'utf-8' }).trim();

      if (clipBackup) spawnSync('pbcopy', { input: clipBackup });

      if (!result || result === '__OPENCLI_EMPTY__') {
        return [{ Content: 'Could not copy chat content. Try clicking in the message area first.' }];
      }

      return [{ Content: result }];
    } catch (err: any) {
      return [{ Content: 'Error: ' + err.message }];
    }
  },
});
