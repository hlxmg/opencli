import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatIflytekOaPendingTodos, listIflytekOaPendingTodos } from './utils.js';

export const pendingTodosCommand = cli({
  site: 'iflytek_oa',
  name: 'todo-list',
  aliases: ['pending-todos'],
  description: 'List pending OA todos from the current in.iflytek.com session',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'limit', required: false, default: '20', help: 'Maximum number of pending todos to return' },
    { name: 'category', required: false, help: 'Filter by the site category name such as OA or 绩效管理' },
  ],
  columns: ['FlowId', 'Title', 'Source', 'Category', 'Sender', 'UpdatedAt', 'URL'],
  func: async (page, kwargs) => {
    const rawLimit = Number(kwargs.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : NaN;
    if (!Number.isFinite(limit)) throw new ArgumentError('--limit must be a number');

    const category = typeof kwargs.category === 'string' ? kwargs.category : undefined;
    const todos = await listIflytekOaPendingTodos(page, limit, category);
    return formatIflytekOaPendingTodos(todos);
  },
});
