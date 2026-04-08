import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { createIflytekLeaveDraft, formatIflytekLeaveDraftResult } from './utils.js';

export const createDraftCommand = cli({
  site: 'iflytek_leave',
  name: 'create-draft',
  description: 'Create and save an iFlytek leave request draft',
  domain: 'oa.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'type', required: true, help: 'Leave type, such as 事假 or 病假' },
    { name: 'reason', help: 'Leave reason shown after selecting the leave type' },
    { name: 'start', required: true, help: 'Leave start date, e.g. 2026-04-05 or 2026-04-05 09:00' },
    { name: 'end', required: true, help: 'Leave end date, e.g. 2026-04-06 or 2026-04-06 18:00' },
    { name: 'duration', required: true, help: 'Leave duration in hours, e.g. 8' },
    { name: 'approver', required: true, help: 'Exact approver name for 自选审批人' },
    { name: 'phone', help: 'Optional contact phone number to fill into 联系电话' },
  ],
  columns: ['Status', 'Type', 'Reason', 'Start', 'End', 'Duration', 'Approver', 'RequestId', 'URL'],
  func: async (page, kwargs) => {
    const type = String(kwargs.type ?? '').trim();
    const start = String(kwargs.start ?? '').trim();
    const end = String(kwargs.end ?? '').trim();
    const duration = String(kwargs.duration ?? '').trim();
    const approver = String(kwargs.approver ?? '').trim();

    if (!type || !start || !end || !duration || !approver) {
      throw new ArgumentError('--type, --start, --end, --duration and --approver are required');
    }

    const result = await createIflytekLeaveDraft(page, {
      type,
      reason: kwargs.reason ? String(kwargs.reason).trim() : undefined,
      start,
      end,
      duration,
      approver,
      phone: kwargs.phone ? String(kwargs.phone).trim() : undefined,
    });
    return formatIflytekLeaveDraftResult(result);
  },
});
