import { execSync, spawnSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sendCommand = cli({
  site: 'feishu',
  name: 'send',
  description: 'Send a message in the active Feishu conversation window',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [{ name: 'text', required: true, positional: true, help: 'Message to send' }],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    const text = kwargs.text as string;
    try {
      let clipBackup = '';
      try { clipBackup = execSync('pbpaste', { encoding: 'utf-8' }); } catch {}

      spawnSync('pbcopy', { input: text });

      execSync("osascript -e 'tell application \"Lark\" to activate'");
      execSync("osascript -e 'delay 0.5'");

      const cmd = "osascript " +
                  "-e 'tell application \"System Events\"' " +
                  "-e 'keystroke \"v\" using command down' " +
                  "-e 'delay 0.2' " +
                  "-e 'keystroke return' " +
                  "-e 'end tell'";
      execSync(cmd);

      if (clipBackup) spawnSync('pbcopy', { input: clipBackup });

      return [{ Status: 'Success' }];
    } catch (err: any) {
      return [{ Status: 'Error: ' + err.message }];
    }
  },
});
