import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { searchIflytekBbsTopics } from './utils.js';

export const searchCommand = cli({
  site: 'iflytek_bbs',
  name: 'search',
  description: 'Search BBS topics from the current logged-in session',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'keyword', required: true, help: 'Forum search keyword' },
    { name: 'limit', required: false, default: '20', help: 'Maximum number of topics to return' },
  ],
  columns: ['Title', 'Author', 'Board', 'UpdatedAt', 'URL'],
  func: async (page, kwargs) => {
    const rawLimit = Number(kwargs.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : NaN;
    if (!Number.isFinite(limit)) throw new ArgumentError('--limit must be a number');

    const keyword = typeof kwargs.keyword === 'string' ? kwargs.keyword.trim() : '';
    if (!keyword) throw new ArgumentError('--keyword is required');

    return searchIflytekBbsTopics(page, keyword, limit);
  },
});
