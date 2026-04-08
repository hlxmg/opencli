import { sendCommand } from '@jackwener/opencli/browser';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_OA_HOME_URL = 'https://in.iflytek.com/';
export const IFLYTEK_OA_TODO_URL = 'https://in.iflytek.com/fornt/mhc/index#/000';
export const IFLYTEK_OA_DOMAIN = 'in.iflytek.com';
export const IFLYTEK_OA_WORKSPACE = 'site:iflytek_oa';
export const IFLYTEK_OA_MAX_PAGE_SIZE = 30;
const PENDING_HANDLE_STATUS = '100';
const DONE_HANDLE_STATUS = '101';

const PENDING_KEYWORDS = ['待办', '待处理', '审批中', '审批', '待审批'];
const NON_PENDING_KEYWORDS = ['已办', '已处理', '已完成', '办结', '已结束'];
const DATE_PATTERN = /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\b/;

interface TabInfo {
  tabId?: number;
}

export interface IflytekOaPageState {
  href?: string;
  title?: string;
  bodyText?: string;
}

export interface RawIflytekOaTodoCandidate {
  title?: string;
  text?: string;
  url?: string;
  flowId?: string;
  status?: string;
  updatedAt?: string;
}

export interface RawIflytekOaPageItem {
  id?: string;
  title?: string;
  sendTime?: string;
  sendName?: string;
  category?: string;
  typeName?: string;
  businessPcUrl?: string;
  handleStatus?: string;
  readStatus?: string;
}

interface RawIflytekOaPageInfo {
  list?: RawIflytekOaPageItem[];
  total?: number;
  pages?: number;
  pageNum?: number;
  pageSize?: number;
  size?: number;
}

interface RawIflytekOaResponse {
  result?: boolean;
  message?: string;
  content?: {
    pageInfo?: RawIflytekOaPageInfo;
  };
}

export interface IflytekOaPendingTodo {
  flowId: string;
  title: string;
  status: string;
  updatedAt: string;
  url: string;
  summary: string;
  sender: string;
  category: string;
  source: string;
}

export interface IflytekOaTodoDetail {
  title: string;
  status: string;
  flowId: string;
  url: string;
  sender: string;
  updatedAt: string;
  detailText: string;
}

export type IflytekOaApprovalAction = 'approve' | 'reject';

export interface IflytekOaApprovalResult {
  title: string;
  action: IflytekOaApprovalAction;
  flowId: string;
  status: 'approved' | 'rejected';
  message: string;
  url: string;
}

function normalizeCategoryFilter(category: string | undefined): string | undefined {
  const normalized = collapseWhitespace(category);
  return normalized || undefined;
}

function collapseWhitespace(value: string | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string | undefined): string {
  return collapseWhitespace(String(value ?? '').replace(/<[^>]+>/g, ''));
}

function includesKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function extractIflytekOaFlowIdFromUrl(url: string | undefined): string {
  const normalized = collapseWhitespace(url);
  if (!normalized) return '';

  const explicitMatch = normalized.match(/[?#&](?:requestid|messageId)=([^&#]+)/i);
  if (explicitMatch?.[1]) return collapseWhitespace(decodeURIComponent(explicitMatch[1]));

  const trimmed = normalized.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathMatch = trimmed.match(/\/([^/]+)$/);
  return pathMatch?.[1] ? collapseWhitespace(decodeURIComponent(pathMatch[1])) : '';
}

function normalizeStatus(candidate: RawIflytekOaTodoCandidate, summary: string): string {
  const explicit = collapseWhitespace(candidate.status);
  if (explicit) return explicit;

  const pool = `${collapseWhitespace(candidate.title)} ${summary}`;
  for (const keyword of PENDING_KEYWORDS) {
    if (pool.includes(keyword)) return keyword === '审批' ? '待办' : keyword;
  }

  return '待办';
}

function normalizeIflytekOaTodoCandidates(
  candidates: RawIflytekOaTodoCandidate[],
  statusLabel = '待办',
): IflytekOaPendingTodo[] {
  const results: IflytekOaPendingTodo[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const summary = collapseWhitespace(candidate.text);
    const haystack = `${collapseWhitespace(candidate.title)} ${collapseWhitespace(candidate.status)} ${summary}`;
    if (!haystack) continue;

    const isDone = statusLabel === '已办';
    if (isDone) {
      const matchesDone = includesKeyword(haystack, NON_PENDING_KEYWORDS) || collapseWhitespace(candidate.status) === '已办';
      if (!matchesDone) continue;
    } else {
      if (includesKeyword(haystack, NON_PENDING_KEYWORDS)) continue;
      if (!includesKeyword(haystack, PENDING_KEYWORDS)) continue;
    }

    const todo: IflytekOaPendingTodo = {
      flowId: collapseWhitespace(candidate.flowId) || extractIflytekOaFlowIdFromUrl(candidate.url),
      title: deriveTitle(candidate, summary),
      status: isDone ? '已办' : normalizeStatus(candidate, summary),
      updatedAt: deriveUpdatedAt(candidate, summary),
      url: collapseWhitespace(candidate.url),
      summary,
      sender: '',
      category: '',
      source: '',
    };

    const dedupKey = buildDedupKey(todo);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    results.push(todo);
  }

  return results;
}

function deriveTitle(candidate: RawIflytekOaTodoCandidate, summary: string): string {
  const explicit = collapseWhitespace(candidate.title);
  if (explicit) return explicit;

  const lines = String(candidate.text ?? '')
    .split('\n')
    .map((line) => collapseWhitespace(line))
    .filter(Boolean);

  const preferred = lines.find((line) =>
    /申请|审批|流程|报销|采购|请假|用印|合同|付款/.test(line)
    && line.length >= 4
    && !DATE_PATTERN.test(line));
  if (preferred) return preferred;

  const meaningful = lines.find((line) =>
    line.length >= 2
    && !DATE_PATTERN.test(line)
    && !includesKeyword(line, PENDING_KEYWORDS)
    && !includesKeyword(line, NON_PENDING_KEYWORDS));

  if (meaningful) return meaningful;
  return summary || '未命名待办';
}

function deriveUpdatedAt(candidate: RawIflytekOaTodoCandidate, summary: string): string {
  const explicit = collapseWhitespace(candidate.updatedAt);
  if (explicit) return explicit;

  const match = summary.match(DATE_PATTERN) ?? String(candidate.text ?? '').match(DATE_PATTERN);
  return match ? match[0] : '';
}

function buildDedupKey(todo: IflytekOaPendingTodo): string {
  return todo.url || `${todo.title}|${todo.updatedAt}|${todo.status}`;
}

function isLoginPage(state: IflytekOaPageState): boolean {
  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  return href.includes('/sso/login')
    || href.includes('/accounts/page/login')
    || /统一认证平台|扫码登录|账号登录|验证码登录/.test(bodyText);
}

export function normalizeIflytekOaPendingTodos(candidates: RawIflytekOaTodoCandidate[]): IflytekOaPendingTodo[] {
  return normalizeIflytekOaTodoCandidates(candidates, '待办');
}

export function normalizeIflytekOaPageItems(
  items: RawIflytekOaPageItem[],
  statusLabel = '待办',
): IflytekOaPendingTodo[] {
  return items
    .map((item) => {
      const title = stripHtml(item.title);
      const url = collapseWhitespace(item.businessPcUrl);
      if (!title || !url) return null;

      const sender = collapseWhitespace(item.sendName);
      const category = collapseWhitespace(item.category);
      const source = collapseWhitespace(item.typeName);
      const summary = [source, category, sender].filter(Boolean).join(' | ');

      return {
        flowId: collapseWhitespace(item.id) || extractIflytekOaFlowIdFromUrl(url),
        title,
        status: statusLabel,
        updatedAt: collapseWhitespace(item.sendTime),
        url,
        summary,
        sender,
        category,
        source,
      } satisfies IflytekOaPendingTodo;
    })
    .filter((item): item is IflytekOaPendingTodo => Boolean(item));
}

export function selectIflytekOaTodosFromPageItems(
  items: RawIflytekOaPageItem[],
  limit: number,
  category?: string,
  statusLabel = '待办',
): IflytekOaPendingTodo[] {
  const normalized = normalizeIflytekOaPageItems(items, statusLabel);
  const filtered = filterIflytekOaTodosByCategory(normalized, category);
  return filtered.slice(0, Math.max(1, Math.min(100, Math.floor(limit))));
}

export function formatIflytekOaPendingTodos(todos: IflytekOaPendingTodo[]): Array<Record<string, string>> {
  return todos.map((todo) => ({
    FlowId: todo.flowId || '-',
    Title: todo.title,
    Source: todo.source || '-',
    Category: todo.category || '-',
    Sender: todo.sender || '-',
    UpdatedAt: todo.updatedAt || '-',
    URL: todo.url || '-',
  }));
}

export function findIflytekOaTodoByFlowId(
  todos: IflytekOaPendingTodo[],
  flowId: string,
): IflytekOaPendingTodo {
  const normalizedFlowId = collapseWhitespace(flowId);
  const matched = todos.find((todo) =>
    todo.flowId === normalizedFlowId || extractIflytekOaFlowIdFromUrl(todo.url) === normalizedFlowId);
  if (!matched) {
    throw new CommandExecutionError(`No OA todo matched FlowId: ${normalizedFlowId}`);
  }
  return matched;
}

function normalizeIflytekOaDetailText(bodyText: string | undefined): string {
  return collapseWhitespace(bodyText).slice(0, 6000);
}

export function formatIflytekOaTodoDetail(detail: IflytekOaTodoDetail): Array<Record<string, string>> {
  return [{
    Title: detail.title || '-',
    Status: detail.status || '-',
    FlowId: detail.flowId || '-',
    URL: detail.url || '-',
    Sender: detail.sender || '-',
    UpdatedAt: detail.updatedAt || '-',
    DetailText: detail.detailText || '-',
  }];
}

export function normalizeIflytekOaApprovalAction(action: string | undefined): IflytekOaApprovalAction {
  const normalized = collapseWhitespace(action).toLowerCase();
  if (normalized === 'approve' || normalized === 'reject') return normalized;
  throw new CommandExecutionError(`Unsupported OA approval action: ${String(action ?? '') || '(empty)'}`);
}

export function formatIflytekOaApprovalResult(
  result: IflytekOaApprovalResult,
): Array<Record<string, string>> {
  return [{
    Title: result.title || '-',
    Action: result.action,
    FlowId: result.flowId || '-',
    Status: result.status,
    Message: result.message || '-',
    URL: result.url || '-',
  }];
}

function buildIflytekOaApprovalScript(action: IflytekOaApprovalAction, comment: string): string {
  return `
    (async () => {
      const OPENCLI_MARK = '__opencli_iflytek_oa_approval__';
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (check, timeoutMs, intervalMs = 150) => {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          const value = check();
          if (value) return value;
          await sleep(intervalMs);
        }
        return null;
      };
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const textOf = (node) => normalize(node?.innerText || node?.textContent || '');
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const clickEl = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        if (typeof el.click === 'function') el.click();
        return true;
      };
      const setInputValue = (input, value) => {
        if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      };
      const findVisibleButton = (patterns, root = document) =>
        Array.from(root.querySelectorAll('button, span, a, div'))
          .find((el) => visible(el) && patterns.some((pattern) => pattern.test(textOf(el))));
      const findCommentInput = (root = document) =>
        Array.from(root.querySelectorAll('textarea, input'))
          .find((el) => {
            if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
            if (!visible(el) || el.disabled || el.readOnly) return false;
            const meta = normalize([
              el.getAttribute('placeholder'),
              el.getAttribute('aria-label'),
              el.getAttribute('name'),
              el.getAttribute('id'),
              el.closest('label, .ant-form-item, td, tr, div')?.textContent,
            ].filter(Boolean).join(' '));
            return /意见|审批|批示|处理|备注|说明/.test(meta) || el instanceof HTMLTextAreaElement;
          });
      const getOverlays = () =>
        Array.from(document.querySelectorAll('.ant-modal-wrap, .ant-modal, .ant-drawer, .ant-popover, .ant-popover-content, .wea-new-con'))
          .filter((el) => el instanceof HTMLElement && visible(el));
      const getToastText = () =>
        Array.from(document.querySelectorAll('.ant-message, .ant-notification, .toast, .weui-toast'))
          .map((node) => textOf(node))
          .filter(Boolean)
          .join(' | ');
      const actionPatterns = ${JSON.stringify(action)} === 'approve'
        ? [/^同意$/, /通过/, /批准/, /审批通过/, /^提交$/]
        : [/^不同意$/, /驳回/, /拒绝/, /退回/];
      const confirmPatterns = ${JSON.stringify(action)} === 'approve'
        ? [/确认/, /确定/, /^提交$/, /发送/, /^同意$/, /通过/]
        : [/确认/, /确定/, /^提交$/, /发送/, /^不同意$/, /驳回/, /拒绝/, /退回/];

      if (${JSON.stringify(comment)}) {
        const pageInput = findCommentInput(document);
        if (pageInput) setInputValue(pageInput, ${JSON.stringify(comment)});
      }

      const initialOverlayCount = getOverlays().length;
      const actionButton = findVisibleButton(actionPatterns, document);
      if (!(actionButton instanceof HTMLElement)) {
        throw new Error('approval action button missing: ' + ${JSON.stringify(action)});
      }
      clickEl(actionButton);
      await sleep(500);

      const latestOverlay = getOverlays().at(-1) || null;
      let submitted = false;
      if (latestOverlay && ${JSON.stringify(comment)}) {
        const overlayInput = findCommentInput(latestOverlay);
        if (overlayInput) setInputValue(overlayInput, ${JSON.stringify(comment)});
      }

      if (latestOverlay instanceof HTMLElement) {
        const confirmButton = findVisibleButton(confirmPatterns, latestOverlay);
        if (confirmButton instanceof HTMLElement) {
          clickEl(confirmButton);
          submitted = true;
        } else if (getOverlays().length > initialOverlayCount) {
          return {
            ok: false,
            submitted: false,
            status: ${JSON.stringify(action)} === 'approve' ? 'approved' : 'rejected',
            message: '审批对话框已打开，但未找到最终提交按钮',
            href: location.href,
          };
        }
      } else {
        submitted = true;
      }

      const toastText = await waitFor(() => {
        const toast = getToastText();
        return toast ? toast : null;
      }, 4000, 200);
      const bodyText = textOf(document.body);
      const successByBody = /成功|完成|已提交|已处理|审批完成|处理成功/.test(bodyText);
      if (!toastText && !successByBody) {
        return {
          ok: false,
          submitted,
          status: ${JSON.stringify(action)} === 'approve' ? 'approved' : 'rejected',
          message: submitted ? '未检测到审批成功提示，请确认页面是否要求额外操作' : '审批动作未提交',
          href: location.href,
        };
      }
      const message = toastText || '审批动作已完成';

      return {
        ok: true,
        submitted,
        status: ${JSON.stringify(action)} === 'approve' ? 'approved' : 'rejected',
        message,
        href: location.href,
      };
    })()
  `;
}

export function filterIflytekOaTodosByCategory(
  todos: IflytekOaPendingTodo[],
  category?: string,
): IflytekOaPendingTodo[] {
  const normalizedCategory = normalizeCategoryFilter(category);
  if (!normalizedCategory) return todos;

  return todos.filter((todo) => {
    const source = collapseWhitespace(todo.source);
    const itemCategory = collapseWhitespace(todo.category);
    const summaryParts = String(todo.summary ?? '')
      .split('|')
      .map((part) => collapseWhitespace(part))
      .filter(Boolean);
    return source === normalizedCategory
      || itemCategory === normalizedCategory
      || summaryParts.includes(normalizedCategory);
  });
}

export async function getIflytekOaPageState(page: IPage): Promise<IflytekOaPageState> {
  return page.evaluate(`
    (() => ({
      href: location.href,
      title: document.title || '',
      bodyText: (document.body?.innerText || '').slice(0, 2500),
    }))()
  `) as Promise<IflytekOaPageState>;
}

async function getIflytekOaDetailPageState(page: IPage): Promise<IflytekOaPageState> {
  return page.evaluate(`
    (() => ({
      href: location.href,
      title: document.title || '',
      bodyText: (document.body?.innerText || '').slice(0, 8000),
    }))()
  `) as Promise<IflytekOaPageState>;
}

async function adoptExistingIflytekOaTab(): Promise<void> {
  const activeMatches = await sendCommand('tabs', {
    op: 'find',
    workspace: IFLYTEK_OA_WORKSPACE,
    domain: IFLYTEK_OA_DOMAIN,
    active: true,
  }) as TabInfo[] | null;

  const anyMatches = activeMatches && activeMatches.length > 0
    ? activeMatches
    : await sendCommand('tabs', {
        op: 'find',
        workspace: IFLYTEK_OA_WORKSPACE,
        domain: IFLYTEK_OA_DOMAIN,
      }) as TabInfo[] | null;

  const tabId = anyMatches?.find((tab) => typeof tab.tabId === 'number')?.tabId;
  if (typeof tabId === 'number') {
    await sendCommand('tabs', {
      op: 'adopt',
      workspace: IFLYTEK_OA_WORKSPACE,
      tabId,
    });
  }
}

async function navigateToIflytekOaTodos(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_OA_TODO_URL);
  } catch {
    // Shared browser sessions can briefly lose the inspected target during navigation.
  }
  await page.wait(2);
}

async function ensureIflytekOaReady(page: IPage): Promise<void> {
  await adoptExistingIflytekOaTab().catch(() => {});

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await getIflytekOaPageState(page);
    if (isLoginPage(state)) {
      throw new AuthRequiredError(IFLYTEK_OA_DOMAIN, 'Please open Chrome and log in to in.iflytek.com before listing OA todos.');
    }

    if (state.href?.includes('/fornt/mhc/index')) return;
    if (state.href?.startsWith(IFLYTEK_OA_HOME_URL) || state.href?.includes(IFLYTEK_OA_DOMAIN)) {
      await navigateToIflytekOaTodos(page);
      continue;
    }

    try {
      await page.goto(IFLYTEK_OA_HOME_URL);
    } catch {
      // Shared browser sessions can briefly lose the inspected target during navigation.
    }
    await page.wait(2);
  }

  throw new CommandExecutionError('Failed to open the iFlytek OA todo page.');
}

async function fetchIflytekOaPage(
  page: IPage,
  pageNum: number,
  numPerPage: number,
  category?: string,
  handleStatus: string = PENDING_HANDLE_STATUS,
): Promise<RawIflytekOaResponse> {
  const normalizedCategory = normalizeCategoryFilter(category);
  return page.evaluate(`
    (async () => {
      const params = new URLSearchParams({
        numPerPage: ${JSON.stringify(String(numPerPage))},
        pageNum: ${JSON.stringify(String(pageNum))},
        typeCode: '000',
        copy: '000',
        processedYear: '',
        processedYearValue: '',
        handleStatus: ${JSON.stringify(handleStatus)},
        queryKey: '',
        category: ${JSON.stringify(normalizedCategory ?? '')},
        twoLevelClass: '',
        minAmount: '',
        maxAmount: '',
      });
      const response = await fetch('getMhcInformation', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
      });
      return await response.json();
    })()
  `) as Promise<RawIflytekOaResponse>;
}

async function extractIflytekOaTodoCandidates(page: IPage, statusLabel = '待办'): Promise<RawIflytekOaTodoCandidate[]> {
  return page.evaluate(`
    (() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'))
        .filter((node) => /ViewRequest\\.jsp|checkDetail|IflyAppClient/.test(node.href));

      return anchors.slice(0, 400).map((anchor) => {
        const element = anchor instanceof HTMLElement ? anchor : null;
        const text = (element?.innerText || element?.textContent || '').replace(/\\s+/g, ' ').trim();
        const lines = (element?.innerText || element?.textContent || '')
          .split('\\n')
          .map((line) => line.trim())
          .filter(Boolean);
        return {
          title: (element?.querySelector('.topic')?.textContent || lines[0] || '').trim(),
          text,
          url: anchor.href || '',
          flowId: (() => {
            const href = anchor.href || '';
            const explicitMatch = href.match(/[?#&](?:requestid|messageId)=([^&#]+)/i);
            if (explicitMatch?.[1]) return explicitMatch[1];
            const trimmed = href.replace(/[?#].*$/, '').replace(/\/+$/, '');
            return trimmed.match(/\/([^/]+)$/)?.[1] || '';
          })(),
          status: ${JSON.stringify(statusLabel)},
          updatedAt: (element?.querySelector('.c1')?.getAttribute('title') || lines[1] || '').trim(),
        };
      });
    })()
  `) as Promise<RawIflytekOaTodoCandidate[]>;
}

export async function listIflytekOaPendingTodos(
  page: IPage,
  limit = 20,
  category?: string,
): Promise<IflytekOaPendingTodo[]> {
  return listIflytekOaTodos(page, {
    limit,
    category,
    emptyMessage: 'No pending OA todos were found',
    handleStatus: PENDING_HANDLE_STATUS,
    statusLabel: '待办',
  });
}

export async function listIflytekOaDoneTodos(
  page: IPage,
  limit = 20,
  category?: string,
): Promise<IflytekOaPendingTodo[]> {
  return listIflytekOaTodos(page, {
    limit,
    category,
    emptyMessage: 'No processed OA todos were found',
    handleStatus: DONE_HANDLE_STATUS,
    statusLabel: '已办',
  });
}

function resolveIflytekOaStatusConfig(status: string | undefined): {
  handleStatus: string;
  statusLabel: string;
} {
  return status === 'done'
    ? { handleStatus: DONE_HANDLE_STATUS, statusLabel: '已办' }
    : { handleStatus: PENDING_HANDLE_STATUS, statusLabel: '待办' };
}

async function collectIflytekOaTodosForLookup(
  page: IPage,
  handleStatus: string,
  statusLabel: string,
): Promise<IflytekOaPendingTodo[]> {
  await ensureIflytekOaReady(page);

  try {
    const firstPage = await fetchIflytekOaPage(page, 1, IFLYTEK_OA_MAX_PAGE_SIZE, undefined, handleStatus);
    if (!firstPage?.result) {
      throw new CommandExecutionError(firstPage?.message || 'Failed to load OA todos from getMhcInformation');
    }

    const pageInfo = firstPage.content?.pageInfo;
    const pages = Math.max(1, Number(pageInfo?.pages ?? 1));
    const items = Array.isArray(pageInfo?.list) ? [...pageInfo.list] : [];

    for (let pageNum = 2; pageNum <= pages; pageNum += 1) {
      const nextPage = await fetchIflytekOaPage(page, pageNum, IFLYTEK_OA_MAX_PAGE_SIZE, undefined, handleStatus);
      if (!nextPage?.result) break;
      const list = nextPage.content?.pageInfo?.list;
      if (Array.isArray(list)) items.push(...list);
    }

    const todos = normalizeIflytekOaPageItems(items, statusLabel);
    if (todos.length > 0) return todos;
  } catch {
    // Fall back to DOM extraction when the internal endpoint changes or returns an unexpected payload.
  }

  return normalizeIflytekOaTodoCandidates(await extractIflytekOaTodoCandidates(page, statusLabel), statusLabel)
    .map((todo) => ({ ...todo, status: statusLabel }));
}

export async function getIflytekOaTodoDetail(
  page: IPage,
  options: { id?: string; url?: string; status?: string },
): Promise<IflytekOaTodoDetail> {
  const providedUrl = collapseWhitespace(options.url);
  const providedId = collapseWhitespace(options.id);
  if (!providedUrl && !providedId) {
    throw new CommandExecutionError('Either --id or --url is required');
  }

  const { handleStatus, statusLabel } = resolveIflytekOaStatusConfig(options.status);
  const matchedTodo = providedUrl
    ? null
    : findIflytekOaTodoByFlowId(
        await collectIflytekOaTodosForLookup(page, handleStatus, statusLabel),
        providedId,
      );

  const targetUrl = providedUrl || matchedTodo?.url || '';
  if (!targetUrl) {
    throw new CommandExecutionError(`No OA todo detail URL was found for FlowId: ${providedId}`);
  }

  try {
    await page.goto(targetUrl);
  } catch {
    // Shared browser sessions can briefly lose the inspected target during navigation.
  }
  await page.wait(2);

  const state = await getIflytekOaDetailPageState(page);
  if (isLoginPage(state)) {
    throw new AuthRequiredError(IFLYTEK_OA_DOMAIN, 'Please open Chrome and log in to in.iflytek.com before reading OA todo details.');
  }

  const detailText = normalizeIflytekOaDetailText(state.bodyText);
  if (!detailText) {
    throw new CommandExecutionError('Failed to read the OA detail page');
  }

  const flowId = matchedTodo?.flowId || providedId || extractIflytekOaFlowIdFromUrl(targetUrl);
  return {
    title: matchedTodo?.title || collapseWhitespace(state.title) || '未命名事项',
    status: matchedTodo?.status || statusLabel,
    flowId,
    url: state.href || targetUrl,
    sender: matchedTodo?.sender || '',
    updatedAt: matchedTodo?.updatedAt || '',
    detailText,
  };
}

export async function approveIflytekOaTodo(
  page: IPage,
  options: { id?: string; url?: string; action: string; comment?: string },
): Promise<IflytekOaApprovalResult> {
  const action = normalizeIflytekOaApprovalAction(options.action);
  const detail = await getIflytekOaTodoDetail(page, {
    id: options.id,
    url: options.url,
    status: 'pending',
  });

  const rawResult = await page.evaluate(
    buildIflytekOaApprovalScript(action, collapseWhitespace(options.comment)),
  ) as { ok?: boolean; submitted?: boolean; status?: string; message?: string; href?: string } | null;

  if (!rawResult?.ok || rawResult.submitted === false) {
    throw new CommandExecutionError(rawResult?.message || 'Failed to execute the OA approval action');
  }

  return {
    title: detail.title,
    action,
    flowId: detail.flowId,
    status: action === 'approve' ? 'approved' : 'rejected',
    message: collapseWhitespace(rawResult.message) || (action === 'approve' ? '审批成功' : '审批已拒绝'),
    url: collapseWhitespace(rawResult.href) || detail.url,
  };
}

async function listIflytekOaTodos(
  page: IPage,
  options: {
    limit: number;
    category?: string;
    emptyMessage: string;
    handleStatus: string;
    statusLabel: string;
  },
): Promise<IflytekOaPendingTodo[]> {
  await ensureIflytekOaReady(page);

  const cappedLimit = Math.max(1, Math.min(100, Math.floor(options.limit)));
  const pageSize = Math.min(IFLYTEK_OA_MAX_PAGE_SIZE, Math.max(cappedLimit, 15));
  const normalizedCategory = normalizeCategoryFilter(options.category);

  try {
    const firstPage = await fetchIflytekOaPage(page, 1, pageSize, normalizedCategory, options.handleStatus);
    if (!firstPage?.result) {
      throw new CommandExecutionError(firstPage?.message || 'Failed to load OA pending todos from getMhcInformation');
    }

    const pageInfo = firstPage.content?.pageInfo;
    const pages = Math.max(1, Number(pageInfo?.pages ?? 1));
    const items = Array.isArray(pageInfo?.list) ? [...pageInfo.list] : [];

    for (let pageNum = 2; pageNum <= pages && items.length < cappedLimit; pageNum += 1) {
      const nextPage = await fetchIflytekOaPage(page, pageNum, pageSize, normalizedCategory, options.handleStatus);
      if (!nextPage?.result) break;
      const list = nextPage.content?.pageInfo?.list;
      if (Array.isArray(list)) items.push(...list);
    }

    const todos = selectIflytekOaTodosFromPageItems(items, cappedLimit, normalizedCategory, options.statusLabel);
    if (todos.length > 0) {
      return todos;
    }

    if (normalizedCategory) {
      const retryFirstPage = await fetchIflytekOaPage(page, 1, pageSize, undefined, options.handleStatus);
      if (retryFirstPage?.result) {
        const retryPageInfo = retryFirstPage.content?.pageInfo;
        const retryPages = Math.max(1, Number(retryPageInfo?.pages ?? 1));
        const retryItems = Array.isArray(retryPageInfo?.list) ? [...retryPageInfo.list] : [];

        for (let pageNum = 2; pageNum <= retryPages; pageNum += 1) {
          const matchedSoFar = selectIflytekOaTodosFromPageItems(
            retryItems,
            cappedLimit,
            normalizedCategory,
            options.statusLabel,
          );
          if (matchedSoFar.length >= cappedLimit) break;

          const retryNextPage = await fetchIflytekOaPage(page, pageNum, pageSize, undefined, options.handleStatus);
          if (!retryNextPage?.result) break;
          const list = retryNextPage.content?.pageInfo?.list;
          if (Array.isArray(list)) retryItems.push(...list);
        }

        const retriedTodos = selectIflytekOaTodosFromPageItems(
          retryItems,
          cappedLimit,
          normalizedCategory,
          options.statusLabel,
        );
        if (retriedTodos.length > 0) {
          return retriedTodos;
        }
      }
    }
  } catch {
    // Fall back to DOM extraction when the internal endpoint changes or returns an unexpected payload.
  }

  const candidates = await extractIflytekOaTodoCandidates(page, options.statusLabel);
  const todos = filterIflytekOaTodosByCategory(
    normalizeIflytekOaTodoCandidates(candidates, options.statusLabel),
    normalizedCategory,
  );
  const labeledTodos = todos.map((todo) => ({ ...todo, status: options.statusLabel }));

  if (labeledTodos.length === 0) {
    throw new CommandExecutionError(
      normalizedCategory
        ? `${options.emptyMessage} for category "${normalizedCategory}" on the current in.iflytek.com page.`
        : `${options.emptyMessage} on the current in.iflytek.com page.`,
    );
  }

  return labeledTodos.slice(0, cappedLimit);
}
