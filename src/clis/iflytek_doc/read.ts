import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatIflytekDocReadResult, readIflytekDoc } from './utils.js';

export const readCommand = cli({
  site: 'iflytek_doc',
  name: 'read',
  description: 'Read the title and plain-text body of an iFlytek cloud document',
  domain: 'yf2ljykclb.xfchat.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'doc', required: true, help: 'Existing iFlytek doc URL or doc id (e.g. dox...)' },
  ],
  columns: ['Title', 'Content', 'DocId', 'URL'],
  func: async (page, kwargs) => {
    const doc = String(kwargs.doc ?? '').trim();
    if (!doc) throw new ArgumentError('--doc is required');

    const result = await readIflytekDoc(page, doc);
    return formatIflytekDocReadResult(result);
  },
});
