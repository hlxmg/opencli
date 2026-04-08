import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  IFLYTEK_REIMBURSE_BOT_HOME_URL,
  getIflytekReimburseBotPageState,
  isIflytekReimburseBotReady,
} from './utils.js';

export const prepareSessionCommand = cli({
  site: 'iflytek_reimburse_bot',
  name: 'prepare-session',
  description: 'Open the iFlytek reimburse bot home page in the shared automation workspace so you can log in there',
  domain: 'bzjqr.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  columns: ['Status', 'URL', 'Title', 'Next'],
  func: async (page) => {
    try {
      await page.goto(IFLYTEK_REIMBURSE_BOT_HOME_URL);
    } catch {
      // The page often still lands despite target-change races.
    }
    await page.wait(2);

    const state = await getIflytekReimburseBotPageState(page);
    const ready = isIflytekReimburseBotReady(state);

    return [{
      Status: ready ? 'ready' : 'login-required',
      URL: state.href || IFLYTEK_REIMBURSE_BOT_HOME_URL,
      Title: state.title || '-',
      Next: ready
        ? 'Run opencli iflytek_reimburse_bot pending or create-draft next'
        : 'Finish login in this opened window, then rerun opencli iflytek_reimburse_bot prepare-session',
    }];
  },
});
