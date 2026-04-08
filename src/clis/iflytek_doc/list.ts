import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatIflytekDocListResult, listIflytekDocs, type IflytekDocSpace } from './utils.js';

export const listCommand = cli({
  site: 'iflytek_doc',
  name: 'list',
  description: 'List recent iFlytek cloud documents from your drive',
  domain: 'yf2ljykclb.xfchat.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'limit', default: '10', help: 'Maximum number of docs to list' },
    { name: 'space', default: 'me', choices: ['me', 'home'], help: 'Drive page used when listing documents' },
  ],
  columns: ['Index', 'Title', 'UpdatedAt', 'DocId', 'URL'],
  func: async (page, kwargs) => {
    const rawLimit = Number(kwargs.limit ?? 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.floor(rawLimit))) : NaN;
    if (!Number.isFinite(limit)) throw new ArgumentError('--limit must be a number');

    const result = await listIflytekDocs(page, (kwargs.space ? String(kwargs.space) : 'me') as IflytekDocSpace, limit);
    return formatIflytekDocListResult(result);
  },
});
