import { Page } from '@jackwener/opencli/browser';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_LEAVE_DOMAIN = 'oa.iflytek.com';
export const IFLYTEK_LEAVE_WORKSPACE = 'site:iflytek_leave';
export const IFLYTEK_LEAVE_ENTRY_URL = 'http://oa.iflytek.com/workflow/request/AddRequest.jsp?workflowid=10247&isagent=0&beagenter=0&f_weaver_belongto_userid=';

export interface IflytekLeaveDraftOptions {
  type: string;
  reason?: string;
  start: string;
  end: string;
  duration: string;
  approver: string;
  phone?: string;
}

export interface NormalizedIflytekLeaveDate {
  isoDate: string;
  calendarTitle: string;
}

export interface IflytekLeaveDraftResult {
  status: 'saved';
  type: string;
  reason: string;
  start: string;
  end: string;
  duration: string;
  approver: string;
  requestId: string;
  url: string;
}

interface IflytekLeavePageState {
  href?: string;
  title?: string;
  bodyText?: string;
  requestId?: string;
}

export function normalizeIflytekLeaveMatchText(value: string): string {
  return value.replace(/\s+/g, '');
}

export function normalizeIflytekLeaveDateInput(value: string): NormalizedIflytekLeaveDate {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[\sT].*)?$/);
  if (!match) throw new CommandExecutionError(`Unsupported leave date: ${value}`);

  const [, year, month, day] = match;
  return {
    isoDate: `${year}-${month}-${day}`,
    calendarTitle: `${Number(year)}-${Number(month)}-${Number(day)}`,
  };
}

export function formatIflytekLeaveDraftResult(result: IflytekLeaveDraftResult): Array<Record<string, string>> {
  return [{
    Status: result.status,
    Type: result.type,
    Reason: result.reason,
    Start: result.start,
    End: result.end,
    Duration: result.duration,
    Approver: result.approver,
    RequestId: result.requestId,
    URL: result.url,
  }];
}

async function getIflytekLeavePageState(page: IPage): Promise<IflytekLeavePageState> {
  return await page.evaluate(`
    (() => ({
      href: location.href,
      title: document.title || '',
      bodyText: (document.body?.innerText || '').slice(0, 4000),
      requestId: document.querySelector('#requestid')?.getAttribute('value') || '',
    }))()
  `) as IflytekLeavePageState;
}

async function openIflytekLeaveCreatePage(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_LEAVE_ENTRY_URL);
  } catch {
    // Shared inspected targets can briefly switch during navigation.
  }
  await page.wait(5);

  const state = await getIflytekLeavePageState(page);
  if (/登录|统一认证|扫码登录/.test(state.bodyText || '')) {
    throw new AuthRequiredError(IFLYTEK_LEAVE_DOMAIN, 'Please open Chrome and log in to oa.iflytek.com before creating a leave draft.');
  }

  if (!/请假申请/.test(state.bodyText || '')) {
    throw new CommandExecutionError('Could not open the iFlytek leave request form');
  }
}

function buildLeaveDraftFillScript(options: {
  type: string;
  reason?: string;
  start: NormalizedIflytekLeaveDate;
  end: NormalizedIflytekLeaveDate;
  duration: string;
  approver: string;
  phone?: string;
}): string {
  return `
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const normalize = (value) => String(value || '').replace(/\\s+/g, '');
      const clickEl = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      };
      const setInput = (selector, value) => {
        const input = document.querySelector(selector);
        if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      };
      const setReactInput = (input, value) => {
        if (!(input instanceof HTMLInputElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const getVisibleWraps = () => Array.from(document.querySelectorAll('.ant-modal-wrap'))
        .filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          const style = getComputedStyle(node);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
      const getLatestWrap = () => getVisibleWraps().at(-1) || null;
      const chooseModalItem = async (buttonSelector, targetText, searchText) => {
        const button = document.querySelector(buttonSelector);
        if (!(button instanceof HTMLElement)) {
          throw new Error('browser button missing: ' + buttonSelector);
        }
        clickEl(button);
        await wait(1800);

        const wrap = getLatestWrap();
        if (!(wrap instanceof HTMLElement)) {
          throw new Error('browser modal missing for ' + targetText);
        }

        const modalTitle = (wrap.querySelector('.ant-modal-title')?.textContent || '').trim();
        if (searchText && /人力资源/.test(modalTitle)) {
          const advancedButton = Array.from(wrap.querySelectorAll('button'))
            .find((node) => /高级搜索/.test(node.textContent || ''));
          if (advancedButton instanceof HTMLElement) {
            clickEl(advancedButton);
            await wait(800);
          }

          const lastname = wrap.querySelector('#lastname');
          if (lastname instanceof HTMLInputElement) {
            lastname.focus();
            setReactInput(lastname, searchText);
            const searchButton = Array.from(wrap.querySelectorAll('button'))
              .find((node) => /搜\\s*索/.test(node.textContent || ''));
            if (searchButton instanceof HTMLElement) clickEl(searchButton);
            await wait(3000);
          }
        }

        const item = Array.from(wrap.querySelectorAll('li.cursor-pointer, .ant-table-row, tbody tr'))
          .find((node) => normalize(node.textContent || '').includes(normalize(targetText)));
        if (!(item instanceof HTMLElement)) {
          throw new Error('browser option missing: ' + targetText);
        }

        clickEl(item);
        await wait(300);
        const confirm = Array.from(wrap.querySelectorAll('button'))
          .find((node) => /确定/.test(node.textContent || ''));
        if (confirm instanceof HTMLElement) clickEl(confirm);
        await wait(1800);
      };
      const pickDate = async (fieldId, target) => {
        const icon = document.querySelector('.' + fieldId + '_swapDiv .picker-icon');
        if (!(icon instanceof HTMLElement)) {
          throw new Error('date picker missing: ' + fieldId);
        }
        clickEl(icon);
        await wait(700);

        for (let attempt = 0; attempt < 24; attempt += 1) {
          const yearLabel = document.querySelector('.ant-calendar-year-select')?.textContent || '';
          const monthLabel = document.querySelector('.ant-calendar-month-select')?.textContent || '';
          const year = Number((yearLabel.match(/(\\d{4})/) || [])[1] || 0);
          const month = Number((monthLabel.match(/(\\d{1,2})/) || [])[1] || 0);
          if (!year || !month) break;

          const targetYear = Number(target.isoDate.slice(0, 4));
          const targetMonth = Number(target.isoDate.slice(5, 7));
          if (year === targetYear && month === targetMonth) break;

          const delta = (targetYear - year) * 12 + (targetMonth - month);
          const next = document.querySelector(delta > 0 ? '.ant-calendar-next-month-btn' : '.ant-calendar-prev-month-btn');
          if (!(next instanceof HTMLElement)) break;
          clickEl(next);
          await wait(200);
        }

        const cell = document.querySelector('.ant-calendar-cell[title="' + target.calendarTitle + '"] .ant-calendar-date');
        if (!(cell instanceof HTMLElement)) {
          throw new Error('date option missing: ' + target.calendarTitle);
        }
        clickEl(cell);
        await wait(900);
      };

      ${options.phone ? `setInput('#field57934', ${JSON.stringify(options.phone)});` : ''}
      await chooseModalItem('.field57984_swapDiv .ant-input-group-wrap button', ${JSON.stringify(options.type)});

      const reasonVisible = (() => {
        const node = document.querySelector('.sqyy-class');
        return node ? getComputedStyle(node).display !== 'none' : false;
      })();
      if (reasonVisible) {
        ${options.reason
          ? `await chooseModalItem('.field57985_swapDiv .ant-input-group-wrap button', ${JSON.stringify(options.reason)});`
          : `throw new Error('leave reason is required for the selected leave type');`}
      }

      await pickDate('field57928', ${JSON.stringify(options.start)});
      await pickDate('field57929', ${JSON.stringify(options.end)});
      if (!setInput('#field180421', ${JSON.stringify(options.duration)})) {
        throw new Error('could not fill leave duration');
      }
      await wait(500);
      await chooseModalItem('.field57966_swapDiv .ant-input-group-wrap button', ${JSON.stringify(options.approver)}, ${JSON.stringify(options.approver)});

      const save = Array.from(document.querySelectorAll('span,button,a'))
        .find((node) => (node.textContent || '').trim() === '保存');
      if (!(save instanceof HTMLElement)) {
        throw new Error('save button missing');
      }
      clickEl(save);
      await wait(3000);
      return true;
    })()
  `;
}

function parseRequestIdFromUrl(url: string): string {
  try {
    const matched = url.match(/[?&]requestid=(\d+)/);
    return matched?.[1] ?? '';
  } catch {
    return '';
  }
}

async function readSavedLeaveDraftState(): Promise<IflytekLeavePageState> {
  const activePage = new Page(IFLYTEK_LEAVE_WORKSPACE);
  await activePage.wait(3);
  return await getIflytekLeavePageState(activePage);
}

export async function createIflytekLeaveDraft(page: IPage, options: IflytekLeaveDraftOptions): Promise<IflytekLeaveDraftResult> {
  const start = normalizeIflytekLeaveDateInput(options.start);
  const end = normalizeIflytekLeaveDateInput(options.end);
  await openIflytekLeaveCreatePage(page);

  try {
    await page.evaluate(buildLeaveDraftFillScript({
      type: options.type,
      reason: options.reason,
      start,
      end,
      duration: options.duration,
      approver: options.approver,
      phone: options.phone,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Inspected target navigated or closed/.test(message)) {
      throw new CommandExecutionError(`Could not fill the iFlytek leave form: ${message}`);
    }
  }

  const state = await readSavedLeaveDraftState();
  const requestId = state.requestId || parseRequestIdFromUrl(state.href || '');
  if (!requestId || requestId === '-1') {
    throw new CommandExecutionError('Could not verify the iFlytek leave draft was saved');
  }

  const bodyText = state.bodyText || '';
  if (!bodyText.includes(options.type) || !bodyText.includes(options.approver)) {
    throw new CommandExecutionError('The saved iFlytek leave draft is missing expected values');
  }

  return {
    status: 'saved',
    type: options.type,
    reason: options.reason ?? '-',
    start: start.isoDate,
    end: end.isoDate,
    duration: options.duration,
    approver: options.approver,
    requestId,
    url: state.href || '',
  };
}
