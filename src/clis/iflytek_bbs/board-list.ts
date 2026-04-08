import { cli, Strategy } from '@jackwener/opencli/registry';
import { listIflytekBbsBoards } from './utils.js';

export const boardListCommand = cli({
  site: 'iflytek_bbs',
  name: 'board-list',
  description: 'List visible BBS boards from the current logged-in session',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [],
  columns: ['Board', 'Description', 'URL'],
  func: async (page) => listIflytekBbsBoards(page),
});
