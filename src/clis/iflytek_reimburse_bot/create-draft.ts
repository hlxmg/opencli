import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  createIflytekReimburseBotDraft,
  formatIflytekReimburseBotDraftResult,
  normalizeIflytekReimburseBotProjectCode,
  normalizeIflytekReimburseBotTypeFilter,
} from './utils.js';

export const createDraftCommand = cli({
  site: 'iflytek_reimburse_bot',
  name: 'create-draft',
  description: 'Create and save an iFlytek reimburse bot draft from all current pending records or a selected type',
  domain: 'bzjqr.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'project-code', required: true, help: 'Project code to fill before saving the reimbursement draft' },
    { name: 'type', help: 'Optional reimbursement type filter, such as 加班交通费' },
  ],
  columns: ['Status', 'Type', 'ProjectCode', 'RecordCount', 'BillNo', 'URL'],
  func: async (page, kwargs) => {
    const rawProjectCode = String(kwargs['project-code'] ?? '').trim();
    if (!rawProjectCode) throw new ArgumentError('--project-code is required');

    const result = await createIflytekReimburseBotDraft(page, {
      projectCode: normalizeIflytekReimburseBotProjectCode(rawProjectCode),
      type: normalizeIflytekReimburseBotTypeFilter(
        typeof kwargs.type === 'string' ? kwargs.type : undefined,
      ),
    });
    return formatIflytekReimburseBotDraftResult(result);
  },
});
