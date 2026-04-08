import { sendCommand } from '@jackwener/opencli/browser';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_DOC_ORIGIN = 'https://yf2ljykclb.xfchat.iflytek.com';
export const IFLYTEK_DOC_HOME_URL = `${IFLYTEK_DOC_ORIGIN}/drive/home/`;
export const IFLYTEK_DOC_ME_URL = `${IFLYTEK_DOC_ORIGIN}/drive/me/`;
export const IFLYTEK_DOC_WORKSPACE = 'site:iflytek_doc';
export const IFLYTEK_DOC_DOMAIN = 'yf2ljykclb.xfchat.iflytek.com';

export type IflytekDocSpace = 'me' | 'home';

export interface IflytekDocPageState {
  href?: string;
  title?: string;
  bodyText?: string;
  editorText?: string;
  docTitleText?: string;
  titleInputVisible?: boolean;
}

export interface IflytekDocTarget {
  docId: string;
  url: string;
}

export interface IflytekDocListItem {
  docId: string;
  title: string;
  url: string;
  updatedAt: string;
}

export interface IflytekDocWriteOptions {
  title: string;
  content: string;
  doc?: string;
  space?: IflytekDocSpace;
}

export interface IflytekDocWriteResult {
  status: 'saved';
  mode: 'new' | 'reuse';
  docId: string;
  title: string;
  url: string;
  space: IflytekDocSpace;
}

export interface IflytekDocReadResult {
  docId: string;
  title: string;
  content: string;
  url: string;
}

export interface IflytekDocCreateRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

const IFLYTEK_DOC_CREATE_URL = '/space/api/explorer/create/';
const IFLYTEK_DOC_MY_SPACE_OBJECTS_URL = '/space/api/explorer/v3/my_space/obj/?asc=0&rank=0&thumbnail_width=1028&thumbnail_height=1028&thumbnail_policy=4&length=16';
const IFLYTEK_DOC_OBJECT_TYPE = 22;

function buildIflytekDocMySpaceObjectsUrl(limit: number): string {
  const params = new URLSearchParams();
  params.set('asc', '0');
  params.set('rank', '0');
  params.set('thumbnail_width', '1028');
  params.set('thumbnail_height', '1028');
  params.set('thumbnail_policy', '4');
  params.set('length', String(limit));
  return `/space/api/explorer/v3/my_space/obj/?${params.toString()}`;
}

export function getIflytekDocCreateEntrySelectors(): string[] {
  return [
    'button[data-selector="explorer-v3-create_new_file"]',
  ];
}

export function getIflytekDocCreateTypeLabels(): string[] {
  return [
    '文档',
    '在线文档',
    '新建文档',
  ];
}

interface TabInfo {
  tabId?: number;
}

function getSpaceUrl(space: IflytekDocSpace = 'me'): string {
  return space === 'home' ? IFLYTEK_DOC_HOME_URL : IFLYTEK_DOC_ME_URL;
}

function isLoginPage(state: IflytekDocPageState): boolean {
  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  return href.includes('/accounts/page/login')
    || href.includes('/sso/login')
    || /扫码登录|统一认证平台|i讯飞 登录|账号登录|验证码登录/.test(bodyText);
}

export function normalizeIflytekDocTarget(value: string): IflytekDocTarget {
  const trimmed = value.trim();
  if (!trimmed) throw new CommandExecutionError('Unsupported iFlytek doc target: empty value');

  const directMatch = trimmed.match(/^(dox[\w-]+)$/i);
  if (directMatch) {
    const docId = directMatch[1];
    return {
      docId,
      url: `${IFLYTEK_DOC_ORIGIN}/docx/${docId}`,
    };
  }

  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/^\/docx\/(dox[\w-]+)/i);
    if (!match) {
      throw new CommandExecutionError(`Unsupported iFlytek doc target: ${value}`);
    }
    const docId = match[1];
    return {
      docId,
      url: `${parsed.origin}/docx/${docId}`,
    };
  } catch (error) {
    if (error instanceof CommandExecutionError) throw error;
    throw new CommandExecutionError(`Unsupported iFlytek doc target: ${value}`);
  }
}

export function isIflytekDocReady(state: IflytekDocPageState): boolean {
  if (isLoginPage(state)) return false;

  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  if (href.includes('/docx/')) {
    return /输入“\/”快速插入内容|添加图标|添加封面|分享|编辑/.test(bodyText);
  }

  if (href.includes('/drive/')) {
    return /新建|添加|模板库/.test(bodyText);
  }

  return false;
}

export function formatIflytekDocWriteResult(result: IflytekDocWriteResult): Array<Record<string, string>> {
  return [{
    Status: result.status,
    Mode: result.mode,
    Title: result.title,
    DocId: result.docId,
    Space: result.space,
    URL: result.url,
  }];
}

export function parseIflytekDocCsrfToken(cookieText: string): string {
  return cookieText.match(/(?:^|;\s*)_csrf_token=([^;]+)/)?.[1] ?? '';
}

export function extractIflytekDocRootFolderToken(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = 'data' in payload && payload.data && typeof payload.data === 'object'
    ? payload.data
    : payload;
  const entities = 'entities' in data && data.entities && typeof data.entities === 'object'
    ? data.entities
    : null;
  const nodes = entities && 'nodes' in entities && entities.nodes && typeof entities.nodes === 'object'
    ? entities.nodes
    : null;
  if (!nodes) return '';

  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== 'object') continue;
    const type = 'type' in node ? node.type : undefined;
    const token = 'token' in node && typeof node.token === 'string' ? node.token : '';
    if (type === 4 && token) return token;
  }

  return '';
}

export function buildIflytekDocCreateRequest(csrfToken: string, folderToken: string): IflytekDocCreateRequest {
  const params = new URLSearchParams();
  params.set('type', '22');
  params.set('folder_token', folderToken);

  return {
    url: '/space/api/explorer/create/',
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRFToken': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: params.toString(),
  };
}

export function isIflytekDocTitleCommitted(state: Pick<IflytekDocPageState, 'docTitleText' | 'titleInputVisible'>, expectedTitle: string): boolean {
  return state.docTitleText === expectedTitle && state.titleInputVisible === false;
}

export function buildIflytekDocBodyPastePayload(content: string): string {
  return `\n${content}`;
}

export function getIflytekDocAppendScrollSettleSeconds(): number {
  return 1.5;
}

export function shouldIflytekDocBodySetDomSelection(options?: { appendToEnd?: boolean }): boolean {
  return options?.appendToEnd !== true;
}

async function verifyIflytekDocAppendCommitted(page: IPage, content: string): Promise<boolean> {
  try {
    await page.wait({ text: content, timeout: 3 });
    return true;
  } catch {
    // Fall back to checking after scrolling the editor viewport to the bottom.
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const found = await page.evaluate(`
      (() => {
        const scroller = document.querySelector('.bear-web-x-container');
        if (scroller instanceof HTMLElement) {
          scroller.scrollTop = scroller.scrollHeight;
        }
        return (document.body?.innerText || '').includes(${JSON.stringify(content)});
      })()
    `) as boolean;

    if (found) return true;
    await page.wait(0.5);
  }

  return false;
}

export function isIflytekDocBodyCommitted(state: Pick<IflytekDocPageState, 'editorText'>, expectedTitle: string, expectedBody: string): boolean {
  const editorText = state.editorText ?? '';
  return editorText.includes(expectedTitle) && editorText.includes(expectedBody);
}

export function extractIflytekDocContentBlocks(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const text = 'text' in item && typeof item.text === 'string' ? item.text.trim() : '';
      return text;
    })
    .filter(Boolean);
}

export function formatIflytekDocContent(blocks: string[]): string {
  return blocks.join('\n\n').trim();
}

export function extractIflytekDocListItems(payload: unknown): IflytekDocListItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = 'data' in payload && payload.data && typeof payload.data === 'object'
    ? payload.data
    : payload;
  const entities = 'entities' in data && data.entities && typeof data.entities === 'object'
    ? data.entities
    : null;
  const nodes = entities && 'nodes' in entities && entities.nodes && typeof entities.nodes === 'object'
    ? entities.nodes
    : null;
  if (!nodes) return [];

  return Object.values(nodes)
    .map((node) => {
      if (!node || typeof node !== 'object') return null;
      const type = 'type' in node ? node.type : undefined;
      if (type !== IFLYTEK_DOC_OBJECT_TYPE) return null;

      const docId = typeof (node as Record<string, unknown>).obj_token === 'string'
        ? String((node as Record<string, unknown>).obj_token)
        : typeof (node as Record<string, unknown>).token === 'string'
          ? String((node as Record<string, unknown>).token)
          : '';
      if (!docId) return null;

      const title = typeof (node as Record<string, unknown>).title === 'string'
        ? String((node as Record<string, unknown>).title)
        : typeof (node as Record<string, unknown>).name === 'string'
          ? String((node as Record<string, unknown>).name)
          : 'Untitled';
      const updatedAt = typeof (node as Record<string, unknown>).edit_time === 'string'
        ? String((node as Record<string, unknown>).edit_time)
        : typeof (node as Record<string, unknown>).update_time === 'string'
          ? String((node as Record<string, unknown>).update_time)
          : typeof (node as Record<string, unknown>).mtime === 'string'
            ? String((node as Record<string, unknown>).mtime)
            : '';

      return {
        docId,
        title,
        updatedAt,
        url: `${IFLYTEK_DOC_ORIGIN}/docx/${docId}`,
      };
    })
    .filter((item): item is IflytekDocListItem => Boolean(item));
}

export function formatIflytekDocListResult(items: IflytekDocListItem[]): Array<Record<string, string>> {
  return items.map((item, index) => ({
    Index: String(index + 1),
    Title: item.title,
    UpdatedAt: item.updatedAt || '-',
    DocId: item.docId,
    URL: item.url,
  }));
}

export function formatIflytekDocReadResult(result: IflytekDocReadResult): Array<Record<string, string>> {
  return [{
    Title: result.title,
    Content: result.content,
    DocId: result.docId,
    URL: result.url,
  }];
}

export function getIflytekDocWritePhases(_mode: IflytekDocWriteResult['mode']): Array<'body' | 'title'> {
  return ['title', 'body'];
}

export function getIflytekDocTitleSettleSeconds(): number {
  return 4;
}

export function getIflytekDocBodyEditorSelector(): string {
  return '.zone-container.text-editor';
}

export function getIflytekDocTitleFocusAttempts(): number {
  return 20;
}

export async function getIflytekDocPageState(page: IPage): Promise<IflytekDocPageState> {
  const state = await page.evaluate(`
    (() => {
      const contentText = Array.from(document.querySelectorAll('.page-block.root-block, .page-block-children'))
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean)
        .join('\\n')
        .trim();

      return {
        href: location.href,
        title: document.title || '',
        bodyText: (document.body?.innerText || '').slice(0, 1200),
        editorText: contentText,
        docTitleText: (document.querySelector('.suite-title__title')?.textContent || '').trim(),
        titleInputVisible: !!document.querySelector('.note-title__input-container input.ud__native-input'),
      };
    })()
  `) as IflytekDocPageState;

  return state;
}

async function adoptExistingIflytekDocTab(): Promise<void> {
  const activeMatches = await sendCommand('tabs', {
    op: 'find',
    workspace: IFLYTEK_DOC_WORKSPACE,
    domain: IFLYTEK_DOC_DOMAIN,
    active: true,
  }) as TabInfo[] | null;

  const anyMatches = activeMatches && activeMatches.length > 0
    ? activeMatches
    : await sendCommand('tabs', {
        op: 'find',
        workspace: IFLYTEK_DOC_WORKSPACE,
        domain: IFLYTEK_DOC_DOMAIN,
      }) as TabInfo[] | null;

  const tabId = anyMatches?.find((tab) => typeof tab.tabId === 'number')?.tabId;
  if (typeof tabId === 'number') {
    await sendCommand('tabs', {
      op: 'adopt',
      workspace: IFLYTEK_DOC_WORKSPACE,
      tabId,
    });
  }
}

export async function navigateToIflytekDocSpace(page: IPage, space: IflytekDocSpace = 'me'): Promise<void> {
  await adoptExistingIflytekDocTab().catch(() => {});
  try {
    await page.goto(getSpaceUrl(space));
  } catch {
    // Shared browser sessions can briefly lose the inspected target during navigation.
  }
  await page.wait(2);

  const state = await getIflytekDocPageState(page);
  if (isLoginPage(state)) {
    throw new AuthRequiredError(IFLYTEK_DOC_DOMAIN, 'Please open Chrome and log in to the iFlytek cloud docs portal first.');
  }
}

async function clickElement(page: IPage, selector: string): Promise<boolean> {
  return await page.evaluate(`
    (() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!(node instanceof HTMLElement)) return false;
      node.click();
      return true;
    })()
  `) as boolean;
}

async function clickTextCandidate(page: IPage, labels: string[]): Promise<boolean> {
  return await page.evaluate(`
    (() => {
      const labels = ${JSON.stringify(labels)};
      const nodes = Array.from(document.querySelectorAll('button, a, li, div, span'));
      const target = nodes.find((node) => {
        const text = (node.textContent || '').trim();
        return labels.some((label) => text === label);
      });
      if (!(target instanceof HTMLElement)) return false;
      target.click();
      return true;
    })()
  `) as boolean;
}

async function waitForDocPage(page: IPage, timeoutSeconds: number = 10): Promise<IflytekDocPageState | null> {
  for (let attempt = 0; attempt < timeoutSeconds * 2; attempt += 1) {
    const state = await getIflytekDocPageState(page);
    if (state.href?.includes('/docx/')) return state;
    await page.wait(0.5);
  }
  return null;
}

async function createIflytekDocViaApi(page: IPage): Promise<IflytekDocTarget | null> {
  const result = await page.evaluate(`
    (async () => {
      const csrfToken = ${parseIflytekDocCsrfToken.toString()}(document.cookie || '');
      if (!csrfToken) return { ok: false, reason: 'missing_csrf' };

      const objectsResponse = await fetch(${JSON.stringify(IFLYTEK_DOC_MY_SPACE_OBJECTS_URL)}, {
        credentials: 'include',
      });
      if (!objectsResponse.ok) {
        return { ok: false, reason: 'objects_request_failed', status: objectsResponse.status };
      }

      const objectsPayload = await objectsResponse.json();
      const folderToken = ${extractIflytekDocRootFolderToken.toString()}(objectsPayload);
      if (!folderToken) return { ok: false, reason: 'missing_folder_token' };

      const request = ${buildIflytekDocCreateRequest.toString()}(csrfToken, folderToken);
      const createResponse = await fetch(request.url, {
        method: request.method,
        credentials: 'include',
        headers: request.headers,
        body: request.body,
      });
      const text = await createResponse.text();
      if (!createResponse.ok) {
        return { ok: false, reason: 'create_failed', status: createResponse.status, text: text.slice(0, 240) };
      }

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        return { ok: false, reason: 'invalid_create_payload', text: text.slice(0, 240) };
      }

      const docId = payload?.data?.obj_token;
      const url = payload?.data?.url;
      if (payload?.code !== 0 || typeof docId !== 'string' || typeof url !== 'string') {
        return { ok: false, reason: 'unexpected_create_payload', payload };
      }

      return { ok: true, docId, url };
    })()
  `) as { ok?: boolean; docId?: string; url?: string } | null;

  if (!result?.ok || typeof result.docId !== 'string' || typeof result.url !== 'string') {
    return null;
  }

  try {
    await page.goto(result.url);
  } catch {
    // Shared browser sessions can briefly lose the inspected target during navigation.
  }
  await page.wait(2);

  return {
    docId: result.docId,
    url: result.url,
  };
}

export async function openNewIflytekDoc(page: IPage, space: IflytekDocSpace = 'me'): Promise<IflytekDocPageState> {
  await navigateToIflytekDocSpace(page, space);

  const apiCreatedTarget = await createIflytekDocViaApi(page).catch(() => null);
  if (apiCreatedTarget) {
    const apiDocState = await waitForDocPage(page, 6);
    if (apiDocState?.href?.includes(`/docx/${apiCreatedTarget.docId}`)) return apiDocState;
  }

  let openedCreateMenu = false;
  for (const selector of getIflytekDocCreateEntrySelectors()) {
    const clicked = await clickElement(page, selector).catch(() => false);
    if (clicked) {
      openedCreateMenu = true;
      break;
    }
  }

  if (!openedCreateMenu) {
    openedCreateMenu = await clickTextCandidate(page, ['新建']).catch(() => false);
  }

  if (!openedCreateMenu) {
    throw new CommandExecutionError('Could not find the 新建 entry on the iFlytek drive page');
  }

  const docStateAfterDirectCreate = await waitForDocPage(page, 2);
  if (docStateAfterDirectCreate) return docStateAfterDirectCreate;

  const clickedDocType = await clickTextCandidate(page, getIflytekDocCreateTypeLabels()).catch(() => false);
  if (clickedDocType) {
    const typedDocState = await waitForDocPage(page, 4);
    if (typedDocState) return typedDocState;
  }

  throw new CommandExecutionError('Could not create a new iFlytek cloud document from the current drive page');
}

export async function openIflytekDocTarget(page: IPage, target: string): Promise<IflytekDocTarget> {
  await adoptExistingIflytekDocTab().catch(() => {});
  const normalized = normalizeIflytekDocTarget(target);
  try {
    await page.goto(normalized.url);
  } catch {
    // Shared browser sessions can briefly lose the inspected target during navigation.
  }
  await page.wait(2);

  const state = await getIflytekDocPageState(page);
  if (isLoginPage(state)) {
    throw new AuthRequiredError(IFLYTEK_DOC_DOMAIN, 'Please open Chrome and log in to the iFlytek cloud docs portal first.');
  }
  if (!state.href?.includes(`/docx/${normalized.docId}`)) {
    throw new CommandExecutionError(`Could not open iFlytek doc: ${target}`);
  }
  return normalized;
}

async function openTitleInput(page: IPage): Promise<void> {
  for (let attempt = 0; attempt < getIflytekDocTitleFocusAttempts(); attempt += 1) {
    const ok = await page.evaluate(`
      (() => {
        const title = document.querySelector('.suite-title__title');
        if (!(title instanceof HTMLElement)) return false;

        const reactHandlersKey = Object.getOwnPropertyNames(title)
          .find((key) => key.startsWith('__reactEventHandlers'));
        const reactHandlers = reactHandlersKey
          ? title[reactHandlersKey]
          : undefined;
        if (typeof reactHandlers?.onClick === 'function') {
          reactHandlers.onClick(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        } else {
          title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
          title.click();
        }

        return !!document.querySelector('input.ud__native-input');
      })()
    `) as boolean;

    if (ok) {
      await page.wait(0.5);
      return;
    }

    await page.wait(0.5);
  }

  throw new CommandExecutionError('Could not focus the iFlytek doc title input');
}

export async function writeIflytekDocTitle(page: IPage, title: string): Promise<void> {
  await openTitleInput(page);

  const ok = await page.evaluate(`
    (() => {
      const title = ${JSON.stringify(title)};
      const input = document.querySelector('input.ud__native-input');
      if (!(input instanceof HTMLInputElement)) return false;

      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(input, title);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
      input.blur();
      return true;
    })()
  `) as boolean;

  if (!ok) throw new CommandExecutionError('Could not update the iFlytek doc title');

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await getIflytekDocPageState(page);
    if (isIflytekDocTitleCommitted(state, title)) {
      await page.wait(0.5);
      return;
    }
    await page.wait(0.5);
  }

  throw new CommandExecutionError('Could not verify the iFlytek doc title was committed');
}

export async function writeIflytekDocBody(page: IPage, content: string, options?: { appendToEnd?: boolean }): Promise<void> {
  const payload = buildIflytekDocBodyPastePayload(content);
  const setDomSelection = shouldIflytekDocBodySetDomSelection(options);

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const ok = await page.evaluate(`
      (() => {
        const editor = document.querySelector(${JSON.stringify(getIflytekDocBodyEditorSelector())});
        const hiddenTextarea = document.querySelector('.docx-selection-hidden-textarea');
        if (!(editor instanceof HTMLElement)) return false;

        editor.click();
        editor.focus();
        if (${JSON.stringify(setDomSelection)}) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

        const data = new DataTransfer();
        data.setData('text/plain', ${JSON.stringify(payload)});

        if (hiddenTextarea instanceof HTMLTextAreaElement) {
          hiddenTextarea.focus();
          hiddenTextarea.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
        } else {
          editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
        }

        return true;
      })()
    `) as boolean;

    if (ok) return;
    await page.wait(0.5);
  }

  throw new CommandExecutionError('Could not write the iFlytek doc body');
}

async function appendIflytekDocBodyAtDocumentEnd(page: IPage, content: string): Promise<void> {
  await page.evaluate(`
    (() => {
      const scroller = document.querySelector('.bear-web-x-container');
      if (scroller instanceof HTMLElement) {
        scroller.scrollTop = scroller.scrollHeight;
      }
      return true;
    })()
  `);
  await page.wait(getIflytekDocAppendScrollSettleSeconds());

  const ok = await page.evaluate(`
    (() => {
      const blocks = Array.from(document.querySelectorAll('.page-block-children'))
        .filter((node) => (node.textContent || '').trim());
      const lastBlock = blocks[blocks.length - 1];
      if (!(lastBlock instanceof HTMLElement)) return false;

      lastBlock.click();

      const range = document.createRange();
      range.selectNodeContents(lastBlock);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      document.execCommand('insertText', false, ${JSON.stringify(`\n${content}`)});
      return true;
    })()
  `) as boolean;

  if (!ok) {
    throw new CommandExecutionError('Could not position the iFlytek doc caret at the document end');
  }
}

export async function readIflytekDoc(page: IPage, target: string): Promise<IflytekDocReadResult> {
  const normalized = await openIflytekDocTarget(page, target);
  await page.wait(1);

  const result = await page.evaluate(`
    (() => ({
      title: (document.querySelector('.suite-title__title')?.textContent || '').trim(),
      blocks: Array.from(document.querySelectorAll('.page-block-children'))
        .map((node, index) => ({
          index,
          text: (node.textContent || '').trim(),
        }))
        .filter((item) => item.text),
    }))()
  `) as { title?: string; blocks?: unknown };

  const blocks = extractIflytekDocContentBlocks(result?.blocks);
  return {
    docId: normalized.docId,
    title: result?.title?.trim() || 'Untitled',
    content: formatIflytekDocContent(blocks),
    url: normalized.url,
  };
}

export async function appendIflytekDoc(page: IPage, options: Pick<IflytekDocWriteOptions, 'doc' | 'content'>): Promise<IflytekDocWriteResult> {
  if (!options.doc) {
    throw new CommandExecutionError('--doc is required when appending to an iFlytek doc');
  }

  const target = await openIflytekDocTarget(page, options.doc);
  const state = await getIflytekDocPageState(page);
  const title = state.docTitleText?.trim() || 'Untitled';

  await appendIflytekDocBodyAtDocumentEnd(page, options.content);

  const committed = await verifyIflytekDocAppendCommitted(page, options.content);
  if (!committed) {
    throw new CommandExecutionError('Could not verify the iFlytek doc append was committed');
  }

  await waitForIflytekDocSave(page);

  return {
    status: 'saved',
    mode: 'reuse',
    docId: target.docId,
    title,
    url: target.url,
    space: 'me',
  };
}

export async function listIflytekDocs(page: IPage, space: IflytekDocSpace = 'me', limit: number = 10): Promise<IflytekDocListItem[]> {
  await navigateToIflytekDocSpace(page, space);

  const payload = await page.evaluate(`
    (async () => {
      const response = await fetch(${JSON.stringify(buildIflytekDocMySpaceObjectsUrl(limit))}, {
        credentials: 'include',
      });
      if (!response.ok) {
        return { ok: false, status: response.status };
      }
      return response.json();
    })()
  `);

  return extractIflytekDocListItems(payload).slice(0, limit);
}

export async function waitForIflytekDocSave(page: IPage): Promise<void> {
  try {
    await page.wait({ text: '已经保存到云端', timeout: 8 });
    return;
  } catch {
    // Some page states do not render the banner consistently; fall back to a shorter poll.
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const state = await getIflytekDocPageState(page);
    if (/最近修改|今天修改|刚刚修改/.test(state.bodyText ?? '')) return;
    await page.wait(0.5);
  }

  throw new CommandExecutionError('The iFlytek doc save state could not be verified');
}

export async function writeIflytekDoc(page: IPage, options: IflytekDocWriteOptions): Promise<IflytekDocWriteResult> {
  const space = options.space ?? 'me';
  const mode = options.doc ? 'reuse' : 'new';

  const target = options.doc
    ? await openIflytekDocTarget(page, options.doc)
    : normalizeIflytekDocTarget((await openNewIflytekDoc(page, space)).href ?? '');

  for (const phase of getIflytekDocWritePhases(mode)) {
    if (phase === 'body') {
      await writeIflytekDocBody(page, options.content);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const state = await getIflytekDocPageState(page);
        if (isIflytekDocBodyCommitted(state, options.title, options.content)) break;
        if (attempt === 11) {
          throw new CommandExecutionError('Could not verify the iFlytek doc body was committed');
        }
        await page.wait(0.5);
      }
    } else {
      await writeIflytekDocTitle(page, options.title);
      await page.wait(getIflytekDocTitleSettleSeconds());
    }
    await waitForIflytekDocSave(page);
  }

  const state = await getIflytekDocPageState(page);
  return {
    status: 'saved',
    mode,
    docId: target.docId,
    title: options.title,
    url: state.href || target.url,
    space,
  };
}
