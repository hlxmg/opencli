import fs from 'node:fs';
import path from 'node:path';
import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatIflytekDocWriteResult, type IflytekDocSpace, writeIflytekDoc } from './utils.js';

function resolveWriteContent(kwargs: Record<string, unknown>): string {
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

export const writeCommand = cli({
  site: 'iflytek_doc',
  name: 'write',
  description: 'Create a new iFlytek cloud document by default, or overwrite a specified doc with --doc',
  domain: 'yf2ljykclb.xfchat.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'title', required: true, help: 'Document title' },
    { name: 'content', help: 'Document body content' },
    { name: 'file', help: 'Local file path to read as document body' },
    { name: 'doc', help: 'Existing iFlytek doc URL or doc id (e.g. dox...)' },
    { name: 'space', default: 'me', choices: ['me', 'home'], help: 'Drive page used when creating a new document' },
  ],
  columns: ['Status', 'Mode', 'Title', 'DocId', 'Space', 'URL'],
  func: async (page, kwargs) => {
    const title = String(kwargs.title ?? '').trim();
    if (!title) throw new ArgumentError('--title is required');

    const content = resolveWriteContent(kwargs);
    const result = await writeIflytekDoc(page, {
      title,
      content,
      doc: kwargs.doc ? String(kwargs.doc) : undefined,
      space: (kwargs.space ? String(kwargs.space) : 'me') as IflytekDocSpace,
    });
    return formatIflytekDocWriteResult(result);
  },
});
