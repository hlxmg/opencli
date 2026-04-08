import fs from 'node:fs';
import path from 'node:path';
import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { appendIflytekDoc, formatIflytekDocWriteResult } from './utils.js';

function resolveAppendContent(kwargs: Record<string, unknown>): string {
  const content = typeof kwargs.content === 'string' ? kwargs.content : '';
  const file = typeof kwargs.file === 'string' ? kwargs.file : '';

  if (content && file) {
    throw new ArgumentError('Use either --content or --file, not both');
  }

  if (!content && !file) {
    throw new ArgumentError('Either --content or --file is required');
  }

  if (file) {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      throw new ArgumentError(`File not found: ${resolved}`);
    }
    return fs.readFileSync(resolved, 'utf-8');
  }

  return content;
}

export const appendCommand = cli({
  site: 'iflytek_doc',
  name: 'append',
  description: 'Append content to the end of an existing iFlytek cloud document',
  domain: 'yf2ljykclb.xfchat.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'doc', required: true, help: 'Existing iFlytek doc URL or doc id (e.g. dox...)' },
    { name: 'content', help: 'Content to append to the document body' },
    { name: 'file', help: 'Local file path to read as appended content' },
  ],
  columns: ['Status', 'Mode', 'Title', 'DocId', 'Space', 'URL'],
  func: async (page, kwargs) => {
    const doc = String(kwargs.doc ?? '').trim();
    if (!doc) throw new ArgumentError('--doc is required');

    const content = resolveAppendContent(kwargs);
    const result = await appendIflytekDoc(page, { doc, content });
    return formatIflytekDocWriteResult(result);
  },
});
