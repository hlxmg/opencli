import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatPendingFees, listIflytekReimbersePendingFees, stashPendingFeesFooter } from './utils.js';

export const pendingFeesCommand = cli({
  site: 'iflytek_reimberse',
  name: 'pending-fees',
  description: 'List unreimbursed fees from the iFlytek reimbursement portal',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'page', required: false, help: 'Page number to load', default: 1 },
    { name: 'rows', required: false, help: 'Rows per page', default: 20 },
  ],
  columns: ['ID', 'Type', 'Amount', 'Created', 'Owner', 'Detail'],
  footerExtra: (kwargs) => typeof kwargs.__footer === 'string' ? kwargs.__footer : undefined,
  func: async (page, kwargs) => {
    const result = await listIflytekReimbersePendingFees(page, {
      page: kwargs.page ? Number(kwargs.page) : 1,
      rows: kwargs.rows ? Number(kwargs.rows) : 20,
    });
    stashPendingFeesFooter(kwargs, result.fees);
    return formatPendingFees(result.fees);
  },
});
