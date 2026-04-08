import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { listIflytekBbsTopics } from './utils.js';

export const topicListCommand = cli({
  site: 'iflytek_bbs',
  name: 'topic-list',
  description: 'List visible topics under a BBS board from the current logged-in session',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'board', required: true, help: 'Visible board name on the forum page' },
    { name: 'limit', required: false, default: '20', help: 'Maximum number of topics to return' },
  ],
  columns: ['Title', 'Author', 'Replies', 'Views', 'UpdatedAt', 'URL'],
  func: async (page, kwargs) => {
    const rawLimit = Number(kwargs.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : NaN;
    if (!Number.isFinite(limit)) throw new ArgumentError('--limit must be a number');

    const board = typeof kwargs.board === 'string' ? kwargs.board.trim() : '';
    if (!board) throw new ArgumentError('--board is required');

    return listIflytekBbsTopics(page, board, limit);
  },
});
