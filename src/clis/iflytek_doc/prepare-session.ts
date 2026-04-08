import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  getIflytekDocPageState,
  IFLYTEK_DOC_ME_URL,
  isIflytekDocReady,
  navigateToIflytekDocSpace,
} from './utils.js';

export const prepareSessionCommand = cli({
  site: 'iflytek_doc',
  name: 'prepare-session',
  description: 'Open the iFlytek cloud docs drive page in the shared automation workspace so you can log in there',
  domain: 'yf2ljykclb.xfchat.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  columns: ['Status', 'URL', 'Title', 'Next'],
  func: async (page) => {
    await navigateToIflytekDocSpace(page, 'me');
    const state = await getIflytekDocPageState(page);
    const ready = isIflytekDocReady(state);

    return [{
      Status: ready ? 'ready' : 'login-required',
      URL: state.href || IFLYTEK_DOC_ME_URL,
      Title: state.title || '-',
      Next: ready
        ? 'Run opencli iflytek_doc write --title "..." --content "..."'
        : 'Finish login in this opened window, then run opencli iflytek_doc write',
    }];
  },
});
