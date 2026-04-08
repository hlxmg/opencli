import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  formatIflytekReimburseBotPendingRecords,
  listIflytekReimburseBotPendingRecords,
} from './utils.js';

export const pendingCommand = cli({
  site: 'iflytek_reimburse_bot',
  name: 'pending',
  description: 'List current unreimbursed records from the iFlytek reimburse bot',
  domain: 'bzjqr.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  columns: ['Type', 'Amount', 'Status', 'HappenedAt', 'Source', 'Detail'],
  func: async (page) => {
    const records = await listIflytekReimburseBotPendingRecords(page);
    return formatIflytekReimburseBotPendingRecords(records);
  },
});
