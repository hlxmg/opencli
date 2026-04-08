import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatIflytekOaTodoDetail, getIflytekOaTodoDetail } from './utils.js';

export const detailCommand = cli({
  site: 'iflytek_oa',
  name: 'detail',
  description: 'Read an OA todo detail by FlowId or detail URL from the current in.iflytek.com session',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'id', required: false, help: 'FlowId or internal id returned by todo-list or done-list' },
    { name: 'url', required: false, help: 'Direct OA detail URL such as ViewRequest.jsp?requestid=12345' },
    { name: 'status', required: false, default: 'pending', help: 'Which list to resolve ids from: pending or done', choices: ['pending', 'done'] },
  ],
  columns: ['Title', 'Status', 'FlowId', 'URL', 'Sender', 'UpdatedAt', 'DetailText'],
  func: async (page, kwargs) => {
    const id = typeof kwargs.id === 'string' ? kwargs.id : undefined;
    const url = typeof kwargs.url === 'string' ? kwargs.url : undefined;
    if (!id && !url) throw new ArgumentError('Either --id or --url is required');

    const rawStatus = typeof kwargs.status === 'string' ? kwargs.status : 'pending';
    const status = rawStatus === 'done' ? 'done' : rawStatus === 'pending' ? 'pending' : null;
    if (!status) throw new ArgumentError('--status must be pending or done');

    const detail = await getIflytekOaTodoDetail(page, { id, url, status });
    return formatIflytekOaTodoDetail(detail);
  },
});
