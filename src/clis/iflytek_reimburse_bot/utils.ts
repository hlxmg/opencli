import { Page, sendCommand } from '@jackwener/opencli/browser';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_REIMBURSE_BOT_DOMAIN = 'bzjqr.iflytek.com';
export const IFLYTEK_REIMBURSE_BOT_HOME_URL = 'https://bzjqr.iflytek.com/ecs-console/index.html#/home';
export const IFLYTEK_REIMBURSE_BOT_WORKSPACE = 'site:iflytek_reimburse_bot';

interface TabInfo {
  tabId?: number;
}

export interface IflytekReimburseBotPageState {
  href?: string;
  title?: string;
  bodyText?: string;
}

export interface RawIflytekReimburseBotPendingCandidate {
  title?: string;
  amountText?: string;
  status?: string;
  happenedAt?: string;
  detail?: string;
  source?: string;
  visible?: boolean;
}

export interface IflytekReimburseBotPendingRecord {
  title: string;
  amount: number;
  status: string;
  happenedAt: string;
  detail: string;
  source: string;
  visible: boolean;
}

export interface IflytekReimburseBotDraftResult {
  status: 'saved';
  projectCode: string;
  recordCount: number;
  billNo: string;
  url: string;
  type: string;
}

export interface IflytekReimburseBotProjectModalCandidate {
  text?: string;
  visible?: boolean;
  hasSearchInput?: boolean;
  hasQueryButton?: boolean;
  hasResultRows?: boolean;
}

function collapseWhitespace(value: string | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parseAmount(value: string | undefined): number {
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '').trim();
  if (!normalized) return Number.NaN;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function parseBillNo(bodyText: string): string {
  return bodyText.match(/\bBZ-[A-Z]+?\d+\b/)?.[0] ?? '';
}

function isLoginPage(state: IflytekReimburseBotPageState): boolean {
  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  return href.includes('/login')
    || /统一认证平台|扫码登录|账号登录|验证码登录|登录/.test(bodyText);
}

export function isIflytekReimburseBotReady(state: IflytekReimburseBotPageState): boolean {
  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  return href.includes(IFLYTEK_REIMBURSE_BOT_DOMAIN)
    && /待报销（元）|费用报销|发票夹/.test(bodyText);
}

export function isIflytekReimburseBotDraftEditor(state: IflytekReimburseBotPageState): boolean {
  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  return href.includes('/fssc/')
    && href.includes('billeditor')
    && /对私费用报销单/.test(bodyText)
    && /未提交|保\s*存|提\s*交/.test(bodyText);
}

export function normalizeIflytekReimburseBotPendingCandidates(
  candidates: RawIflytekReimburseBotPendingCandidate[],
): IflytekReimburseBotPendingRecord[] {
  return candidates
    .map((candidate) => {
      const title = collapseWhitespace(candidate.title);
      const amount = parseAmount(candidate.amountText);
      if (!title || !Number.isFinite(amount)) return null;

      return {
        title,
        amount,
        status: collapseWhitespace(candidate.status) || '未报销',
        happenedAt: collapseWhitespace(candidate.happenedAt),
        detail: collapseWhitespace(candidate.detail),
        source: collapseWhitespace(candidate.source),
        visible: candidate.visible !== false,
      } satisfies IflytekReimburseBotPendingRecord;
    })
    .filter((item): item is IflytekReimburseBotPendingRecord => Boolean(item));
}

export function normalizeIflytekReimburseBotPendingText(bodyText: string): IflytekReimburseBotPendingRecord[] {
  const lines = String(bodyText)
    .split('\n')
    .map((line) => collapseWhitespace(line))
    .filter(Boolean);

  const titlePattern = /(费|活动|补贴|车费|餐费|住宿|差旅|交通)/;
  const records: IflytekReimburseBotPendingRecord[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const title = lines[index] ?? '';
    if (!titlePattern.test(title)) continue;

    const windowLines = lines.slice(index + 1, index + 8);
    const amountText = windowLines.find((line) => /¥?\s*\d+(?:\.\d{1,2})/.test(line));
    const status = windowLines.find((line) => /未报销|报销中|已报销/.test(line)) ?? '';
    if (!amountText || !status) continue;

    records.push({
      title,
      amount: parseAmount(amountText),
      status,
      happenedAt: windowLines.find((line) => /20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?/.test(line)) ?? '',
      detail: '',
      source: windowLines.find((line) => /平台|企业支付|滴滴|发票|支付宝/.test(line)) ?? '',
      visible: true,
    });
  }

  return records.filter((record) => Number.isFinite(record.amount));
}

export function selectIflytekReimburseBotPendingRecords(
  records: IflytekReimburseBotPendingRecord[],
): IflytekReimburseBotPendingRecord[] {
  const selected = records.filter((record) => record.visible && record.status.includes('未报销'));
  if (selected.length === 0) {
    throw new CommandExecutionError('No pending reimbursement records were found');
  }
  return selected;
}

export function normalizeIflytekReimburseBotTypeFilter(type: string | undefined): string | undefined {
  const normalized = collapseWhitespace(type);
  return normalized || undefined;
}

export function filterIflytekReimburseBotPendingRecordsByType(
  records: IflytekReimburseBotPendingRecord[],
  type?: string,
): IflytekReimburseBotPendingRecord[] {
  const normalizedType = normalizeIflytekReimburseBotTypeFilter(type);
  if (!normalizedType) return records;

  const lowered = normalizedType.toLowerCase();
  const filtered = records.filter((record) => record.title.toLowerCase().includes(lowered));
  if (filtered.length === 0) {
    throw new CommandExecutionError(`No pending reimbursement records matched type: ${normalizedType}`);
  }
  return filtered;
}

export function summarizeIflytekReimburseBotPendingRecords(
  records: IflytekReimburseBotPendingRecord[],
): { count: number; totalAmount: number } {
  return {
    count: records.length,
    totalAmount: Math.round(records.reduce((sum, record) => sum + record.amount, 0) * 100) / 100,
  };
}

export function formatIflytekReimburseBotPendingRecords(
  records: IflytekReimburseBotPendingRecord[],
): Array<Record<string, string>> {
  return records.map((record) => ({
    Type: record.title,
    Amount: record.amount.toFixed(2),
    Status: record.status || '-',
    HappenedAt: record.happenedAt || '-',
    Source: record.source || '-',
    Detail: record.detail || '-',
  }));
}

export function normalizeIflytekReimburseBotProjectCode(projectCode: string): string {
  const normalized = collapseWhitespace(projectCode);
  if (!normalized) throw new CommandExecutionError('project code is required');
  return normalized;
}

export function isIflytekReimburseBotProjectModalCandidate(
  candidate: IflytekReimburseBotProjectModalCandidate,
): boolean {
  if (!candidate.visible) return false;

  const text = collapseWhitespace(candidate.text);
  const hasProjectTitle = /项目编码/.test(text);
  const hasProjectResults = /费用|项目|查询|重置|确定/.test(text);
  const hasControls = Boolean(candidate.hasSearchInput && candidate.hasQueryButton);

  return Boolean(
    (hasProjectTitle && (candidate.hasSearchInput || candidate.hasResultRows))
      || (hasControls && candidate.hasResultRows && hasProjectResults),
  );
}

export function selectIflytekReimburseBotProjectRow(rows: string[], projectCode: string): string {
  const normalizedProjectCode = normalizeIflytekReimburseBotProjectCode(projectCode);
  const normalizedRows = rows
    .map((row) => collapseWhitespace(row))
    .filter((row) => row.includes(normalizedProjectCode));

  if (normalizedRows.length === 0) {
    throw new CommandExecutionError(`Project code option missing: ${normalizedProjectCode}`);
  }

  const preferredRows = normalizedRows.filter((row) =>
    /费用/.test(row) && (!/外包服务费/.test(row) || /不含外包服务费/.test(row)));
  if (preferredRows.length === 1) return preferredRows[0];
  if (preferredRows.length > 1) {
    throw new CommandExecutionError(`Multiple project code options matched: ${normalizedProjectCode}`);
  }

  if (normalizedRows.length === 1) return normalizedRows[0];
  throw new CommandExecutionError(`Multiple project code options matched: ${normalizedProjectCode}`);
}

export function hasIflytekReimburseBotProjectSelection(bodyText: string, projectCode: string): boolean {
  const normalizedBodyText = collapseWhitespace(bodyText);
  const normalizedProjectCode = normalizeIflytekReimburseBotProjectCode(projectCode);

  if (normalizedBodyText.includes(normalizedProjectCode)) return true;

  const projectSection = normalizedBodyText.match(/项目编码\s+(.+?)\s+报销事由/)?.[1] ?? '';
  const displayValue = collapseWhitespace(projectSection).replace(/\s+-$/, '').trim();
  return Boolean(displayValue && displayValue !== '-');
}

export function normalizeIflytekReimburseBotDraftResult(input: {
  href?: string;
  projectCode: string;
  selectedCount: number;
  type?: string;
  bodyText?: string;
  toastText?: string;
}): IflytekReimburseBotDraftResult {
  const bodyText = input.bodyText ?? '';
  const toastText = input.toastText ?? '';
  const billNo = parseBillNo(bodyText);
  const saved = /保存成功|保存草稿成功|单据保存成功/.test(toastText)
    || (/对私费用报销单/.test(bodyText) && hasIflytekReimburseBotProjectSelection(bodyText, input.projectCode) && Boolean(billNo));

  if (!saved) {
    throw new CommandExecutionError('Could not verify the reimbursement draft was saved');
  }

  return {
    status: 'saved',
    projectCode: input.projectCode,
    recordCount: input.selectedCount,
    billNo,
    url: input.href ?? '',
    type: input.type ?? 'ALL',
  };
}

export async function getIflytekReimburseBotPageState(page: IPage): Promise<IflytekReimburseBotPageState> {
  return page.evaluate(`
    (() => ({
      href: location.href,
      title: document.title || '',
      bodyText: (document.body?.innerText || '').slice(0, 5000),
    }))()
  `) as Promise<IflytekReimburseBotPageState>;
}

async function adoptExistingIflytekReimburseBotTab(): Promise<void> {
  const activeMatches = await sendCommand('tabs', {
    op: 'find',
    workspace: IFLYTEK_REIMBURSE_BOT_WORKSPACE,
    domain: IFLYTEK_REIMBURSE_BOT_DOMAIN,
    active: true,
  }) as TabInfo[] | null;

  const anyMatches = activeMatches && activeMatches.length > 0
    ? activeMatches
    : await sendCommand('tabs', {
        op: 'find',
        workspace: IFLYTEK_REIMBURSE_BOT_WORKSPACE,
        domain: IFLYTEK_REIMBURSE_BOT_DOMAIN,
      }) as TabInfo[] | null;

  const tabId = anyMatches?.find((tab) => typeof tab.tabId === 'number')?.tabId;
  if (typeof tabId === 'number') {
    await sendCommand('tabs', {
      op: 'adopt',
      workspace: IFLYTEK_REIMBURSE_BOT_WORKSPACE,
      tabId,
    });
  }
}

export async function navigateToIflytekReimburseBotHome(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_REIMBURSE_BOT_HOME_URL);
  } catch {
    // Shared browser targets can switch during navigation.
  }
  await page.wait(2);
}

export async function assertIflytekReimburseBotReady(page: IPage): Promise<void> {
  await adoptExistingIflytekReimburseBotTab().catch(() => {});

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await getIflytekReimburseBotPageState(page);
    if (isLoginPage(state)) {
      throw new AuthRequiredError(
        IFLYTEK_REIMBURSE_BOT_DOMAIN,
        'Please open Chrome and log in to bzjqr.iflytek.com before using iflytek_reimburse_bot.',
      );
    }

    if (isIflytekReimburseBotReady(state)) return;
    await navigateToIflytekReimburseBotHome(page);
  }

  throw new CommandExecutionError('Failed to open the iFlytek reimburse bot home page');
}

export async function enterIflytekReimburseBotPendingPage(page: IPage): Promise<void> {
  await assertIflytekReimburseBotReady(page);

  const result = await page.evaluate(`
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const href = location.href;
      if (href.includes('/fssc/') && href.includes('expenserecord/list')) {
        return { iframeSrc: '', href, bodyText: (document.body?.innerText || '').slice(0, 500) };
      }

      if (href.includes('#/outLink')) {
        return {
          iframeSrc: document.querySelector('iframe#fsscCacheIframe, iframe[src*="/fssc/"]')?.src || '',
          href,
          bodyText: (document.body?.innerText || '').slice(0, 500),
        };
      }

      const target = Array.from(document.querySelectorAll('div,span,a,button'))
        .find((el) =>
          typeof el.className === 'string'
          && el.className.includes('components-home-Workplace__task_list')
          && /待报销/.test(el.textContent || ''));

      if (target instanceof HTMLElement) target.click();
      await sleep(2500);

      return {
        iframeSrc: document.querySelector('iframe#fsscCacheIframe, iframe[src*="/fssc/"]')?.src || '',
        href: location.href,
        bodyText: (document.body?.innerText || '').slice(0, 500),
      };
    })()
  `) as { iframeSrc?: string; href?: string; bodyText?: string };

  if (result.iframeSrc) {
    try {
      await page.goto(result.iframeSrc);
    } catch {
      // Shared browser targets can switch during navigation.
    }
    await page.wait(4);
  }

  const state = await getIflytekReimburseBotPageState(page);
  if (!/创建报销单|新增支出记录|我的支出记录/.test(state.bodyText || '')) {
    throw new CommandExecutionError('Could not open the pending reimbursement records page');
  }
}

export async function extractIflytekReimburseBotPendingCandidates(
  page: IPage,
): Promise<RawIflytekReimburseBotPendingCandidate[]> {
  return page.evaluate(`
    (() => {
      const textOf = (node) => (node?.innerText || node?.textContent || '').replace(/\\s+/g, ' ').trim();
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };

      const rowSet = new Set();
      const rows = [];
      const addRow = (node) => {
        if (!(node instanceof Element)) return;
        const row = node.closest('tr, .ant-table-row, [role="row"], li, .ant-list-item, .ant-card, .ant-checkbox-wrapper, div');
        if (!(row instanceof Element) || rowSet.has(row)) return;
        rowSet.add(row);
        rows.push(row);
      };

      Array.from(document.querySelectorAll('input.ant-checkbox-input')).slice(1).forEach(addRow);
      Array.from(document.querySelectorAll('tr, .ant-table-row, [role="row"], li, .ant-list-item')).forEach((row) => {
        const text = textOf(row);
        if (/未报销|报销中|已报销/.test(text) && /\\d+(?:\\.\\d{1,2})/.test(text)) addRow(row);
      });

      return rows.map((row) => {
        const text = textOf(row);
        const cells = Array.from(row.querySelectorAll('td, th, .ant-table-cell, span, div'))
          .map(textOf)
          .filter(Boolean)
          .slice(0, 40);
        const amountText = cells.find((cell) => /¥?\\s*\\d+(?:\\.\\d{1,2})/.test(cell)) || text.match(/¥?\\s*\\d+(?:\\.\\d{1,2})/)?.[0] || '';
        const status = cells.find((cell) => /未报销|报销中|已报销/.test(cell)) || '';
        const happenedAt = cells.find((cell) => /20\\d{2}-\\d{2}-\\d{2}(?:\\s+\\d{2}:\\d{2}:\\d{2})?/.test(cell)) || '';
        const title = cells.find((cell) =>
          cell.length >= 2
          && !/未报销|报销中|已报销/.test(cell)
          && !/¥?\\s*\\d+(?:\\.\\d{1,2})/.test(cell)
          && !/20\\d{2}-\\d{2}-\\d{2}/.test(cell)
          && !/创建报销单|批量删除|转 交|转交/.test(cell))
          || '';
        const source = cells.find((cell) => /平台|企业支付|滴滴|支付宝|发票|交通/.test(cell) && cell !== title) || '';
        const detail = cells
          .filter((cell) => cell !== title && cell !== status && cell !== source && cell !== happenedAt && cell !== amountText)
          .find((cell) => cell.length >= 4 && !/创建报销单|批量删除|转 交|转交/.test(cell)) || '';

        return {
          title,
          amountText,
          status,
          happenedAt,
          detail,
          source,
          visible: visible(row),
        };
      });
    })()
  `) as Promise<RawIflytekReimburseBotPendingCandidate[]>;
}

export async function listIflytekReimburseBotPendingRecords(
  page: IPage,
  type?: string,
): Promise<IflytekReimburseBotPendingRecord[]> {
  await enterIflytekReimburseBotPendingPage(page);
  const candidates = await extractIflytekReimburseBotPendingCandidates(page);
  const normalized = normalizeIflytekReimburseBotPendingCandidates(candidates);
  if (normalized.length > 0) {
    return filterIflytekReimburseBotPendingRecordsByType(selectIflytekReimburseBotPendingRecords(normalized), type);
  }

  const state = await getIflytekReimburseBotPageState(page);
  return filterIflytekReimburseBotPendingRecordsByType(
    selectIflytekReimburseBotPendingRecords(normalizeIflytekReimburseBotPendingText(state.bodyText || '')),
    type,
  );
}

async function openIflytekReimburseBotDraftEditor(page: IPage, type?: string): Promise<number> {
  const result = await page.evaluate(`
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const normalizedType = ${JSON.stringify(normalizeIflytekReimburseBotTypeFilter(type) ?? '')};
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const clickEl = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      };

      const textOf = (node) => (node?.innerText || node?.textContent || '').replace(/\\s+/g, ' ').trim();
      const findRowContainer = (checkbox) => {
        if (!(checkbox instanceof HTMLElement)) return null;
        let cursor = checkbox.parentElement;
        for (let depth = 0; cursor && depth < 8; depth += 1) {
          const text = textOf(cursor);
          if (/未报销|报销中|已报销/.test(text) && /¥?\\s*\\d+(?:\\.\\d{1,2})/.test(text)) return cursor;
          cursor = cursor.parentElement;
        }
        return checkbox.closest('div[class*="list_item"], li, tr, .ant-list-item, .ant-table-row');
      };
      const checkboxes = Array.from(document.querySelectorAll('input.ant-checkbox-input'))
        .filter((input, index) => index > 0 && visible(input));
      const matchedCheckboxes = checkboxes.filter((checkbox) => {
        if (!normalizedType) return true;
        const row = findRowContainer(checkbox);
        return textOf(row).toLowerCase().includes(normalizedType.toLowerCase());
      });

      for (const checkbox of matchedCheckboxes) {
        if (checkbox instanceof HTMLInputElement && !checkbox.checked) {
          clickEl(checkbox);
          await sleep(150);
        }
      }

      if (matchedCheckboxes.length === 0) {
        throw new Error(normalizedType
          ? 'no pending rows matched type: ' + normalizedType
          : 'no pending rows available');
      }

      const createButton = Array.from(document.querySelectorAll('button, span, a'))
        .find((el) => visible(el) && /创建报销单/.test(el.textContent || ''));
      if (!(createButton instanceof HTMLElement)) {
        throw new Error('create draft button missing');
      }

      clickEl(createButton);
      await sleep(2500);
      return matchedCheckboxes.length;
    })()
  `) as number;

  await page.wait(4);
  return result;
}

function buildFillProjectCodeAndSaveScript(projectCode: string): string {
  return `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (check, timeoutMs, intervalMs = 100) => {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          const value = check();
          if (value) return value;
          await sleep(intervalMs);
        }
        return null;
      };
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
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
      const setTextInputValue = (input, value) => {
        if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      };
      const textOf = (node) => normalize(node?.innerText || node?.textContent || '');
      const addUnique = (items, el) => {
        if (!(el instanceof HTMLElement) || !visible(el) || items.includes(el)) return;
        items.push(el);
      };
      const getVisibleProjectModals = () =>
        Array.from(document.querySelectorAll('.ant-modal-wrap, .ant-modal, .ant-drawer, .ecs-dialog, .ant-popover, .ant-popover-content'))
          .filter((el) => el instanceof HTMLElement && visible(el))
          .map((el) => {
            const text = textOf(el);
            return {
              element: el,
              text,
              hasSearchInput: Array.from(el.querySelectorAll('input, textarea'))
                .some((input) =>
                  visible(input)
                  && !(input instanceof HTMLInputElement && (input.type || 'text') === 'hidden')
                  && !input.disabled
                  && !input.readOnly),
              hasQueryButton: Array.from(el.querySelectorAll('button, span, a, div'))
                .some((node) => /查\\s*询|搜\\s*索/.test(textOf(node))),
              hasResultRows: Array.from(el.querySelectorAll('tbody tr, .ant-table-row, li, .ant-list-item, [role="row"]'))
                .some((row) => visible(row) && textOf(row).length > 0),
            };
          })
          .filter((candidate) => {
            if (!candidate.element) return false;
            const hasProjectTitle = /项目编码/.test(candidate.text);
            const hasProjectResults = /费用|项目|查询|重置|确定/.test(candidate.text);
            return (hasProjectTitle && (candidate.hasSearchInput || candidate.hasResultRows))
              || (candidate.hasSearchInput && candidate.hasQueryButton && candidate.hasResultRows && hasProjectResults);
          });
      const findProjectField = () => {
        const fieldBlocks = Array.from(document.querySelectorAll('.field_block_horzontal'))
          .filter((el) => el instanceof HTMLElement && visible(el));
        return fieldBlocks.find((el) => el.getAttribute('code') === 'FXB_DEF_001')
          || fieldBlocks.find((el) => /项目编码/.test(textOf(el)))
          || Array.from(document.querySelectorAll('label, span, div'))
            .find((el) =>
              el instanceof HTMLElement
              && visible(el)
              && /项目编码/.test(textOf(el))
              && el.closest('.field_block_horzontal, .ant-form-item, .field_block_vertical, td, th, tr, .ant-row'));
      };
      const collectProjectTriggers = (field) => {
        const triggers = [];
        if (!(field instanceof HTMLElement)) return triggers;
        const selector = [
          '[class*="bo_field_popup"]',
          '[class*="searchBtn"]',
          '[class*="search-btn"]',
          '[class*="popup"]',
          '.field_control_wrap',
          '.ant-select-selector',
          '.ant-input-affix-wrapper',
          '.ant-input',
          'input',
          'textarea',
          'button',
          'span',
          'a',
          'i',
        ].join(', ');
        Array.from(field.querySelectorAll(selector)).forEach((el) => addUnique(triggers, el));
        const fieldParent = field.closest('.field_block_horzontal, .ant-form-item, .field_block_vertical, td, th, tr, .ant-row');
        if (fieldParent instanceof HTMLElement) {
          Array.from(fieldParent.querySelectorAll(selector)).forEach((el) => addUnique(triggers, el));
          addUnique(triggers, fieldParent);
        }
        addUnique(triggers, field);
        return triggers;
      };
      const pickProjectSearchInput = (modal) =>
        Array.from(modal.querySelectorAll('input, textarea'))
          .find((input) =>
            visible(input)
            && !input.disabled
            && !input.readOnly
            && (
              input.getAttribute('fieldcolumncode') === 'FXM_DEF_004'
              || /项目编码|编码|关键字|查询|搜索/.test(normalize(
                input.getAttribute('placeholder')
                || input.getAttribute('aria-label')
                || input.getAttribute('name')
                || input.getAttribute('id')
                || '',
              ))
            ))
          || Array.from(modal.querySelectorAll('input.ant-input, input, textarea'))
            .find((input) => visible(input) && !input.disabled && !input.readOnly);
      const pickProjectSearchButton = (modal) =>
        modal.querySelector('button[id$="-search"]')
        || Array.from(modal.querySelectorAll('button, span, a, div'))
          .find((el) => /查\\s*询|搜\\s*索/.test(textOf(el)));

      await waitFor(() => {
        const bodyText = textOf(document.body);
        const hasProjectSection = bodyText.includes('项目编码');
        const liveInputs = Array.from(document.querySelectorAll('input, textarea'))
          .filter((el) => visible(el) && !el.disabled && !el.readOnly && (el.type || 'text') !== 'hidden');
        return hasProjectSection && liveInputs.length > 0;
      }, 25000, 250);

      const projectField = findProjectField();
      if (!(projectField instanceof HTMLElement)) {
        throw new Error('project code field missing');
      }

      const projectTriggers = collectProjectTriggers(projectField);
      if (projectTriggers.length === 0) {
        throw new Error('project code trigger missing');
      }

      let projectModal = null;
      for (const trigger of projectTriggers) {
        clickEl(trigger);
        if (trigger instanceof HTMLInputElement || trigger instanceof HTMLTextAreaElement) trigger.focus();
        projectModal = await waitFor(() => {
          const candidates = getVisibleProjectModals();
          return candidates.at(-1)?.element || null;
        }, 2000, 150);
        if (projectModal) break;
      }
      if (!(projectModal instanceof HTMLElement)) {
        throw new Error('project code modal missing');
      }

      const projectSearchInput = pickProjectSearchInput(projectModal);
      if (!(projectSearchInput instanceof HTMLInputElement || projectSearchInput instanceof HTMLTextAreaElement)) {
        throw new Error('project code search input missing');
      }
      setTextInputValue(projectSearchInput, ${JSON.stringify(projectCode)});
      await sleep(300);

      const projectSearchButton = pickProjectSearchButton(projectModal);
      if (!(projectSearchButton instanceof HTMLElement)) {
        throw new Error('project code query button missing');
      }
      clickEl(projectSearchButton);

      const projectRows = await waitFor(() => {
        const rows = Array.from(projectModal.querySelectorAll('tbody tr, .ant-table-row, li, .ant-list-item, [role="row"]'))
          .filter((row) => visible(row) && textOf(row).includes(${JSON.stringify(projectCode)}));
        return rows.length > 0 ? rows : null;
      }, 8000, 200);
      if (!Array.isArray(projectRows) || projectRows.length === 0) {
        throw new Error('project code option missing: ' + ${JSON.stringify(projectCode)});
      }
      const projectRowTexts = projectRows.map((row) => textOf(row));
      const preferredRows = projectRows.filter((row) => {
        const text = textOf(row);
        return /费用/.test(text) && (!/外包服务费/.test(text) || /不含外包服务费/.test(text));
      });
      const projectRow = preferredRows.length === 1 ? preferredRows[0] : preferredRows.length > 1 ? null : projectRows.length === 1 ? projectRows[0] : null;
      if (!(projectRow instanceof HTMLElement)) {
        throw new Error(projectRowTexts.length > 1
          ? 'Multiple project code options matched: ' + ${JSON.stringify(projectCode)}
          : 'project code option missing: ' + ${JSON.stringify(projectCode)});
      }

      const rowCheckbox = projectRow.querySelector('input.ant-checkbox-input, input[type="checkbox"]');
      if (rowCheckbox instanceof HTMLElement) clickEl(rowCheckbox);
      else clickEl(projectRow);
      await sleep(500);

      const confirmButton = Array.from(projectModal.querySelectorAll('button'))
        .find((btn) => /确\\s*定/.test(textOf(btn)));
      if (!(confirmButton instanceof HTMLElement)) {
        throw new Error('project code confirm button missing');
      }
      clickEl(confirmButton);

      const saveButton = await waitFor(() =>
        Array.from(document.querySelectorAll('button, span, a'))
          .find((el) => visible(el) && /^保\\s*存$/.test(textOf(el))) || null,
      8000, 200);
      if (!(saveButton instanceof HTMLElement)) {
        throw new Error('save button missing');
      }

      clickEl(saveButton);
      await sleep(3000);
      return true;
    })()
  `;
}

async function readIflytekReimburseBotDraftState(): Promise<{ href?: string; bodyText?: string; toastText?: string }> {
  const activePage = new Page(IFLYTEK_REIMBURSE_BOT_WORKSPACE);
  await activePage.wait(3);
  return activePage.evaluate(`
    (() => ({
      href: location.href,
      bodyText: (document.body?.innerText || '').slice(0, 6000),
      toastText: Array.from(document.querySelectorAll('.ant-message, .ant-notification, .ant-modal, .ant-drawer'))
        .map((node) => (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' | '),
    }))()
  `) as Promise<{ href?: string; bodyText?: string; toastText?: string }>;
}

export async function createIflytekReimburseBotDraft(
  page: IPage,
  options: { projectCode: string; type?: string },
): Promise<IflytekReimburseBotDraftResult> {
  const projectCode = normalizeIflytekReimburseBotProjectCode(options.projectCode);
  const type = normalizeIflytekReimburseBotTypeFilter(options.type);
  const currentState = await getIflytekReimburseBotPageState(page).catch(() => ({}));
  let pendingRecords: IflytekReimburseBotPendingRecord[] = [];
  let selectedCount = 0;

  if (isIflytekReimburseBotDraftEditor(currentState)) {
    selectedCount = 0;
  } else {
    pendingRecords = await listIflytekReimburseBotPendingRecords(page, type);
    selectedCount = await openIflytekReimburseBotDraftEditor(page, type);
    if (!selectedCount) {
      throw new CommandExecutionError('No pending reimbursement records were selected for the draft');
    }
  }

  try {
    await page.evaluate(buildFillProjectCodeAndSaveScript(projectCode));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Inspected target navigated or closed/.test(message)) {
      throw new CommandExecutionError(`Could not fill the reimbursement draft: ${message}`);
    }
  }

  const state = await readIflytekReimburseBotDraftState();
  const result = normalizeIflytekReimburseBotDraftResult({
    href: state.href,
    bodyText: state.bodyText,
    toastText: state.toastText,
    projectCode,
    type,
    selectedCount: selectedCount > 0 ? Math.min(selectedCount, pendingRecords.length) : 0,
  });

  if (!hasIflytekReimburseBotProjectSelection(state.bodyText || '', projectCode)) {
    throw new CommandExecutionError('The saved reimbursement draft is missing the expected project code');
  }

  return result;
}

export function formatIflytekReimburseBotDraftResult(
  result: IflytekReimburseBotDraftResult,
): Array<Record<string, string>> {
  return [{
    Status: result.status,
    Type: result.type,
    ProjectCode: result.projectCode,
    RecordCount: String(result.recordCount),
    BillNo: result.billNo || '-',
    URL: result.url || '-',
  }];
}
