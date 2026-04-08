import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { readIflytekBbsTopic } from './utils.js';

export const topicReadCommand = cli({
  site: 'iflytek_bbs',
  name: 'topic-read',
  description: 'Read a BBS topic by id from the current logged-in session',
  domain: 'in.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'id', required: true, help: 'Topic id from the forum URL' },
  ],
  func: async (page, kwargs) => {
    const id = typeof kwargs.id === 'string' ? kwargs.id.trim() : '';
    if (!id) throw new ArgumentError('--id is required');
    return readIflytekBbsTopic(page, id);
  },
});
