import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  getIflytekReimbersePageState,
  IFLYTEK_REIMBERSE_LIST_URL,
  isIflytekReimberseReady,
  navigateToIflytekReimberseList,
} from './utils.js';

export const prepareSessionCommand = cli({
  site: 'iflytek_reimberse',
  name: 'prepare-session',
  description: 'Open the iFlytek reimbursement page in the shared automation workspace so you can log in there',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  columns: ['Status', 'URL', 'Next'],
  func: async (page) => {
    await navigateToIflytekReimberseList(page);
    const state = await getIflytekReimbersePageState(page);
    const ready = isIflytekReimberseReady(state);

    return [{
      Status: ready ? 'ready' : 'login-required',
      URL: state.href || IFLYTEK_REIMBERSE_LIST_URL,
      Next: ready
        ? 'Run opencli iflytek_reimberse pending-fees'
        : 'Finish login in this opened window, then run opencli iflytek_reimberse pending-fees',
    }];
  },
});
