import { cli, Strategy } from '@jackwener/opencli/registry';
import { createIflytekReimberseDraft } from './utils.js';

export const createDraftCommand = cli({
  site: 'iflytek_reimberse',
  name: 'create-draft',
  description: 'Create a reimbursement draft from all current unreimbursed fees',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'department', required: true, help: 'Department id or exact department name used for draft creation' },
    { name: 'cost-center', required: false, help: 'Optional cost center id or exact cost center name' },
    { name: 'reason', required: false, help: 'Optional reimbursement reason for the draft' },
  ],
  columns: ['Status', 'Department', 'CostCenter', 'FeeCount', 'TotalAmount', 'Message'],
  func: async (page, kwargs) => {
    return [await createIflytekReimberseDraft(page, {
      department: String(kwargs.department),
      costCenter: kwargs['cost-center'] ? String(kwargs['cost-center']) : undefined,
      reason: kwargs.reason ? String(kwargs.reason) : undefined,
    })];
  },
});
