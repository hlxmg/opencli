import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { CommandArgs, IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_REIMBERSE_LIST_URL = 'http://in.iflytek.com/reimburse/requisition/toListRequisition';
export const IFLYTEK_REIMBERSE_WORKSPACE = 'site:iflytek_reimberse';

export interface IflytekReimbersePageState {
  href?: string;
  bodyText?: string;
}

export interface IflytekReimbersePendingFee {
  id: number;
  chargeType: string;
  amount: number;
  createTime: string;
  account: string;
  owner: string;
  detail: string;
  raw: Record<string, unknown>;
}

export interface IflytekReimbersePendingFeesResult {
  total: number;
  fees: IflytekReimbersePendingFee[];
}

export interface IflytekReimberseDraftContext {
  ids: number[];
  agentAccount: string;
  agentUser: string;
  totalAmount: number;
}

export interface IflytekReimberseDepartmentOption {
  departmentId: string;
  departmentName: string;
  costcenterName: string;
  costcenterEasid: string;
  costcenterCode: string;
  companyName: string;
  companyEasid: string;
  companyCode: string;
  raw: Record<string, unknown>;
}

export interface IflytekReimberseCostCenterOption {
  costcenterName: string;
  costcenterEasid: string;
  costcenterCode: string;
  companyName: string;
  companyEasid: string;
  companyCode: string;
  raw: Record<string, unknown>;
}

interface RawPendingFee {
  id?: number;
  chargeType?: string;
  money?: number;
  actMoney?: number;
  gmtCreate?: string;
  agentAccount?: string;
  agentUser?: string;
  createAccount?: string;
  createUser?: string;
  displayJson?: {
    detail?: string;
  };
  displayDetail?: string;
  [key: string]: unknown;
}

interface RawPendingFeesResponse {
  total?: number;
  list?: RawPendingFee[];
}

function readDetail(raw: RawPendingFee): string {
  if (raw.displayJson?.detail) return String(raw.displayJson.detail);

  if (typeof raw.displayDetail === 'string' && raw.displayDetail.trim()) {
    try {
      const parsed = JSON.parse(raw.displayDetail) as { detail?: string };
      if (parsed?.detail) return String(parsed.detail);
    } catch {
      return raw.displayDetail;
    }
  }

  return '';
}

export function isIflytekReimberseReady(state: IflytekReimbersePageState): boolean {
  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  return href.includes('/reimburse/') && /未报销的费用|未提交的报销单|审批中的报销单/.test(bodyText);
}

export function normalizePendingFeesResponse(raw: RawPendingFeesResponse): IflytekReimbersePendingFeesResult {
  const fees = Array.isArray(raw?.list)
    ? raw.list.map((item) => ({
        id: Number(item.id ?? 0),
        chargeType: String(item.chargeType ?? ''),
        amount: Number(item.money ?? item.actMoney ?? 0),
        createTime: String(item.gmtCreate ?? ''),
        account: String(item.agentAccount ?? item.createAccount ?? ''),
        owner: String(item.agentUser ?? item.createUser ?? ''),
        detail: readDetail(item),
        raw: item,
      }))
    : [];

  return {
    total: Number(raw?.total ?? fees.length),
    fees,
  };
}

export function extractDraftContext(fees: IflytekReimbersePendingFee[]): IflytekReimberseDraftContext {
  if (fees.length === 0) {
    throw new CommandExecutionError('No pending reimbursement fees were found');
  }

  const first = fees[0];
  const summary = summarizePendingFees(fees);
  return {
    ids: fees.map((fee) => fee.id),
    agentAccount: first.account,
    agentUser: first.owner,
    totalAmount: summary.totalAmount,
  };
}

export function buildCreateDraftUrl(context: IflytekReimberseDraftContext): string {
  const ids = `${context.ids.join(',')},`;
  return `http://in.iflytek.com/reimburse/requisition/create?ids=${ids}&type=1&agentAccount=${encodeURIComponent(context.agentAccount)}&agentUser=${encodeURIComponent(context.agentUser)}&isStandard=0`;
}

export function selectDepartmentOption(options: IflytekReimberseDepartmentOption[], query: string): IflytekReimberseDepartmentOption {
  const trimmed = query.trim();
  const lowered = trimmed.toLowerCase();

  const exactById = options.find((option) => option.departmentId === trimmed);
  if (exactById) return exactById;

  const exactByName = options.find((option) => option.departmentName === trimmed);
  if (exactByName) return exactByName;

  const exactByNameCaseInsensitive = options.find((option) => option.departmentName.toLowerCase() === lowered);
  if (exactByNameCaseInsensitive) return exactByNameCaseInsensitive;

  const fuzzyMatches = options.filter((option) =>
    option.departmentId.toLowerCase().includes(lowered) || option.departmentName.toLowerCase().includes(lowered));

  if (fuzzyMatches.length === 1) return fuzzyMatches[0];
  if (fuzzyMatches.length > 1) {
    throw new CommandExecutionError(`Multiple departments matched "${query}". Please use a more specific department id or name.`);
  }

  throw new CommandExecutionError(`No department matched "${query}"`);
}

export function selectCostCenterOption(options: IflytekReimberseCostCenterOption[], query: string): IflytekReimberseCostCenterOption {
  const trimmed = query.trim();
  const lowered = trimmed.toLowerCase();

  const exactById = options.find((option) => option.costcenterEasid === trimmed);
  if (exactById) return exactById;

  const exactByName = options.find((option) => option.costcenterName === trimmed);
  if (exactByName) return exactByName;

  const exactByNameCaseInsensitive = options.find((option) => option.costcenterName.toLowerCase() === lowered);
  if (exactByNameCaseInsensitive) return exactByNameCaseInsensitive;

  const fuzzyMatches = options.filter((option) =>
    option.costcenterEasid.toLowerCase().includes(lowered) || option.costcenterName.toLowerCase().includes(lowered));

  if (fuzzyMatches.length === 1) return fuzzyMatches[0];
  if (fuzzyMatches.length > 1) {
    throw new CommandExecutionError(`Multiple cost centers matched "${query}". Please use a more specific cost center id or name.`);
  }

  throw new CommandExecutionError(`No cost center matched "${query}"`);
}

export async function fetchDepartmentOptions(page: IPage, query: string): Promise<IflytekReimberseDepartmentOption[]> {
  const raw = await page.evaluate(`
    (async () => {
      const params = new URLSearchParams({
        name: ${JSON.stringify(query)},
        pageSize: '100',
        currentPageNo: '1'
      });
      const res = await fetch('/reimburse/remote/org/list', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: params.toString()
      });
      return await res.json();
    })()
  `) as { status?: boolean; data?: Array<Record<string, unknown>> };

  if (!raw?.status || !Array.isArray(raw.data)) {
    throw new CommandExecutionError('Failed to load department options from the reimbursement portal');
  }

  return raw.data.map((item) => ({
    departmentId: String(item.orgEasId ?? ''),
    departmentName: String(item.orgName ?? ''),
    costcenterName: String(item.costCenterName ?? ''),
    costcenterEasid: String(item.costCenterEasId ?? ''),
    costcenterCode: String(item.costCenterCode ?? ''),
    companyName: String(item.companyName ?? ''),
    companyEasid: String(item.companyEasId ?? ''),
    companyCode: String(item.companyCode ?? ''),
    raw: item,
  }));
}

export async function fetchCostCenterOptions(page: IPage, query: string): Promise<IflytekReimberseCostCenterOption[]> {
  const raw = await page.evaluate(`
    (async () => {
      const params = new URLSearchParams({
        name: ${JSON.stringify(query)},
        pageSize: '100',
        currentPageNo: '1'
      });
      const res = await fetch('/reimburse/remote/costCenter/list', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: params.toString()
      });
      return await res.json();
    })()
  `) as { status?: boolean; data?: Array<Record<string, unknown>> };

  if (!raw?.status || !Array.isArray(raw.data)) {
    throw new CommandExecutionError('Failed to load cost center options from the reimbursement portal');
  }

  return raw.data.map((item) => ({
    costcenterName: String(item.costCenterName ?? ''),
    costcenterEasid: String(item.costCenterEasId ?? ''),
    costcenterCode: String(item.costCenterCode ?? ''),
    companyName: String(item.companyName ?? ''),
    companyEasid: String(item.companyEasId ?? ''),
    companyCode: String(item.companyCode ?? ''),
    raw: item,
  }));
}

export async function createIflytekReimberseDraft(
  page: IPage,
  options: { department: string; costCenter?: string; reason?: string; page?: number; rows?: number },
): Promise<Record<string, string | number>> {
  const pending = await listIflytekReimbersePendingFees(page, {
    page: options.page,
    rows: options.rows ?? 100,
  });
  const context = extractDraftContext(pending.fees);
  const departmentOptions = await fetchDepartmentOptions(page, options.department);
  const selectedDepartment = selectDepartmentOption(departmentOptions, options.department);
  const selectedCostCenter = options.costCenter
    ? selectCostCenterOption(await fetchCostCenterOptions(page, options.costCenter), options.costCenter)
    : null;
  const createUrl = buildCreateDraftUrl(context);

  try {
    await page.goto(createUrl);
  } catch {
    // The page often still loads despite target changes.
  }
  await page.wait(2);

  const saveResult = await page.evaluate(`
    (async () => {
      const department = ${JSON.stringify(selectedDepartment)};
      const explicitCostCenter = ${JSON.stringify(selectedCostCenter)};
      const reason = ${JSON.stringify(options.reason ?? '')};

      function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      async function waitFor(check, timeoutMs) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          if (check()) return true;
          await sleep(100);
        }
        return false;
      }

      function serializeForm(form) {
        const params = new URLSearchParams();
        for (const el of form.querySelectorAll('input, textarea, select')) {
          if (!el.name || el.disabled) continue;
          const type = (el.type || '').toLowerCase();
          if (type === 'file') continue;
          if ((type === 'checkbox' || type === 'radio') && !el.checked) continue;
          params.append(el.name, el.value ?? '');
        }
        return params;
      }

      if (typeof renderDepartment !== 'function' || typeof checkIsEntity !== 'function') {
        return { ok: false, message: 'The reimbursement draft page did not finish initializing.' };
      }

      renderDepartment([{
        id: '',
        businessType: 2,
        projectCode: '',
        projectName: '',
        projectLine: '',
        departmentId: department.departmentId,
        departmentName: department.departmentName,
        costcenterName: department.costcenterName,
        costcenterEasid: department.costcenterEasid,
        costcenterCode: department.costcenterCode,
        companyName: department.companyName,
        companyEasid: department.companyEasid,
        companyCode: department.companyCode,
        reqMoney: document.querySelector('#totalMoney')?.value || ''
      }]);

      checkIsEntity(typeof getOldCompanyEasId === 'function' ? getOldCompanyEasId() : '', [{
        companyEasid: explicitCostCenter?.companyEasid || department.companyEasid,
        costcenterEasid: explicitCostCenter?.costcenterEasid || department.costcenterEasid,
        costcenterName: explicitCostCenter?.costcenterName || department.costcenterName,
        costcenterCode: explicitCostCenter?.costcenterCode || department.costcenterCode,
        companyName: explicitCostCenter?.companyName || department.companyName,
        companyCode: explicitCostCenter?.companyCode || department.companyCode
      }]);

      const hasDepartment = await waitFor(
        () => document.querySelector('[name="reqBusinessVos[0].departmentId"]')?.value === department.departmentId,
        5000
      );
      const hasCostCenter = await waitFor(
        () => !!document.querySelector('#costCenter input'),
        5000
      );

      if (!hasDepartment) {
        return { ok: false, message: 'Failed to populate the approval department on the draft page.' };
      }
      if (!hasCostCenter) {
        return { ok: false, message: 'The selected department did not populate a cost center automatically.' };
      }

      if (explicitCostCenter) {
        if (typeof renderCostCenter !== 'function') {
          return { ok: false, message: 'The reimbursement draft page cannot render cost centers right now.' };
        }
        renderCostCenter([{
          costcenterName: explicitCostCenter.costcenterName,
          costcenterEasid: explicitCostCenter.costcenterEasid,
          costcenterCode: explicitCostCenter.costcenterCode,
          companyName: explicitCostCenter.companyName,
          companyEasid: explicitCostCenter.companyEasid,
          companyCode: explicitCostCenter.companyCode
        }]);
      }

      const reasonInput = document.querySelector('textarea[name="reason"]');
      if (reasonInput) {
        reasonInput.value = reason;
        reasonInput.dispatchEvent(new Event('input', { bubbles: true }));
        reasonInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const form = document.querySelector('form');
      if (!form) {
        return { ok: false, message: 'Failed to locate the reimbursement draft form.' };
      }

      const params = serializeForm(form);
      const response = await fetch('/reimburse/requisition/save?isTemp=true', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: params.toString()
      });

      const data = await response.json().catch(async () => ({
        result: false,
        message: await response.text()
      }));

      return {
        ok: !!data.result,
        message: String(data.message ?? ''),
        selectedDepartment: department.departmentName,
        selectedCostCenter: explicitCostCenter?.costcenterName || department.costcenterName,
      };
    })()
  `) as {
    ok?: boolean;
    message?: string;
    selectedDepartment?: string;
    selectedCostCenter?: string;
  };

  if (!saveResult?.ok) {
    throw new CommandExecutionError(saveResult?.message || 'Failed to save the reimbursement draft');
  }

  return {
    Status: 'draft-saved',
    Department: saveResult.selectedDepartment || selectedDepartment.departmentName,
    CostCenter: saveResult.selectedCostCenter || selectedDepartment.costcenterName,
    FeeCount: context.ids.length,
    TotalAmount: context.totalAmount.toFixed(2),
    Message: saveResult.message || 'Draft saved successfully',
  };
}

export function summarizePendingFees(fees: IflytekReimbersePendingFee[]): { count: number; totalAmount: number } {
  const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
  return {
    count: fees.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

export function formatPendingFees(fees: IflytekReimbersePendingFee[]): Array<Record<string, string | number>> {
  return fees.map((fee) => ({
    ID: fee.id,
    Type: fee.chargeType,
    Amount: fee.amount.toFixed(2),
    Created: fee.createTime,
    Owner: fee.owner,
    Detail: fee.detail,
  }));
}

export function buildPendingFeesFooter(summary: { count: number; totalAmount: number }): string {
  return `Pending fees: ${summary.count} | Total amount: ${summary.totalAmount.toFixed(2)}`;
}

export async function getIflytekReimbersePageState(page: IPage): Promise<IflytekReimbersePageState> {
  return page.evaluate(`
    (() => ({
      href: location.href,
      bodyText: (document.body?.innerText || '').slice(0, 1000)
    }))()
  `) as Promise<IflytekReimbersePageState>;
}

export async function navigateToIflytekReimberseList(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_REIMBERSE_LIST_URL);
  } catch {
    // The browser bridge occasionally loses the inspected target during navigation.
  }
  await page.wait(2);
}

export async function assertIflytekReimberseReady(page: IPage): Promise<void> {
  const state = await getIflytekReimbersePageState(page);
  if (!isIflytekReimberseReady(state)) {
    throw new AuthRequiredError('in.iflytek.com', 'Not logged in to the iFlytek reimbursement portal');
  }
}

export async function fetchPendingFees(page: IPage, options: { page?: number; rows?: number } = {}): Promise<IflytekReimbersePendingFeesResult> {
  const pageNo = options.page ?? 1;
  const rows = options.rows ?? 20;

  const raw = await page.evaluate(`
    (async () => {
      const params = new URLSearchParams({
        page: ${JSON.stringify(String(pageNo))},
        rows: ${JSON.stringify(String(rows))},
        startTime: '',
        endTime: '',
        sort: 'GMT_MODIFIED',
        order: 'desc',
        type: ''
      });

      const res = await fetch('/reimburse/baseCharge/listNotReimburseFee', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: params.toString()
      });

      return await res.json();
    })()
  `) as RawPendingFeesResponse;

  if (!raw || typeof raw !== 'object') {
    throw new CommandExecutionError('Failed to load pending reimbursement fees');
  }

  return normalizePendingFeesResponse(raw);
}

export async function listIflytekReimbersePendingFees(page: IPage, options: { page?: number; rows?: number } = {}): Promise<IflytekReimbersePendingFeesResult> {
  await navigateToIflytekReimberseList(page);
  await assertIflytekReimberseReady(page);
  return fetchPendingFees(page, options);
}

export function stashPendingFeesFooter(kwargs: CommandArgs, fees: IflytekReimbersePendingFee[]): void {
  const summary = summarizePendingFees(fees);
  kwargs.__footer = buildPendingFeesFooter(summary);
}
