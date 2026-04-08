import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  approveIflytekOaTodo,
  formatIflytekOaApprovalResult,
  normalizeIflytekOaApprovalAction,
} from './utils.js';

export const approveActionCommand = cli({
  site: 'iflytek_oa',
  name: 'approve-action',
  description: 'Approve or reject a pending OA todo by FlowId or detail URL from the current in.iflytek.com session',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'id', required: false, help: 'Pending FlowId returned by todo-list' },
    { name: 'url', required: false, help: 'Direct OA detail URL such as ViewRequest.jsp?requestid=12345' },
    { name: 'action', required: true, help: 'Approval action to execute', choices: ['approve', 'reject'] },
    { name: 'comment', required: false, help: 'Optional approval comment or rejection reason' },
  ],
  columns: ['Title', 'Action', 'FlowId', 'Status', 'Message', 'URL'],
  func: async (page, kwargs) => {
    const id = typeof kwargs.id === 'string' ? kwargs.id : undefined;
    const url = typeof kwargs.url === 'string' ? kwargs.url : undefined;
    if (!id && !url) throw new ArgumentError('Either --id or --url is required');

    const rawAction = typeof kwargs.action === 'string' ? kwargs.action : undefined;
    if (!rawAction) throw new ArgumentError('--action must be approve or reject');

    let action: 'approve' | 'reject';
    try {
      action = normalizeIflytekOaApprovalAction(rawAction);
    } catch {
      throw new ArgumentError('--action must be approve or reject');
    }

    const comment = typeof kwargs.comment === 'string' ? kwargs.comment : undefined;
    const result = await approveIflytekOaTodo(page, { id, url, action, comment });
    return formatIflytekOaApprovalResult(result);
  },
});
