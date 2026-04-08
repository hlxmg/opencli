import { CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_REPAIR_PORTAL_URL = 'https://in.iflytek.com';
export const IFLYTEK_REPAIR_TEMPLATE_URL = 'https://itsmsdp.iflytek.com/Templates.do?module=incident';
export const IFLYTEK_REPAIR_WORKSPACE = 'site:iflytek_repair';

export type RepairTemplate = 'it' | 'finance' | 'property';

export interface CreateRepairOptions {
  template: RepairTemplate;
  location: string;
  phone: string;
  title: string;
  description: string;
  category?: string;
  subcategory?: string;
}

export interface RepairResult {
  status: 'submitted';
  template: RepairTemplate;
  title: string;
  location: string;
  phone: string;
  requestId?: string;
}

const TEMPLATE_META: Record<RepairTemplate, { label: string; reqTemplate: string }> = {
  it: { label: 'IT报修', reqTemplate: '930' },
  finance: { label: '财务报修', reqTemplate: '910' },
  property: { label: '行政物业报修', reqTemplate: '911' },
};

interface LookupOption {
  id: string;
  name: string;
}

interface RequiredLookupField {
  name: string;
  label: string;
  options: LookupOption[];
}

export function normalizeRepairTemplate(value: string): RepairTemplate {
  if (value === 'it' || value === 'finance' || value === 'property') return value;
  throw new CommandExecutionError(`Unsupported repair template: ${value}`);
}

export function getRepairTemplateMeta(template: RepairTemplate): { label: string; reqTemplate: string } {
  return TEMPLATE_META[template];
}

export function formatRepairResult(result: RepairResult): Record<string, string>[] {
  return [{
    Status: result.status,
    Template: result.template,
    Title: result.title,
    Location: result.location,
    Phone: result.phone,
    RequestId: result.requestId ?? '-',
  }];
}

function normalizeOptionText(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export function resolveLookupOption(options: LookupOption[], query: string): LookupOption | undefined {
  const normalizedQuery = normalizeOptionText(query);
  return options.find((option) => normalizeOptionText(option.name) === normalizedQuery)
    ?? options.find((option) => normalizeOptionText(option.name).includes(normalizedQuery))
    ?? options.find((option) => normalizeOptionText(option.id) === normalizedQuery);
}

export function formatLookupOptionNames(options: LookupOption[]): string {
  return options
    .filter((option) => option.id !== '0')
    .map((option) => option.name)
    .join(' / ');
}

function buildMissingLookupFieldMessage(field: RequiredLookupField): string {
  const optionNames = formatLookupOptionNames(field.options);
  return optionNames
    ? `${field.label} 为必填项，请使用对应参数填写。可选值: ${optionNames}`
    : `${field.label} 为必填项，请先在页面中确认可选值`;
}

async function navigateToRepairTemplates(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_REPAIR_TEMPLATE_URL);
  } catch {
    // Shared browser sessions can briefly lose the inspected target during navigation.
  }
  await page.wait(2);
}

async function ensureRepairSession(page: IPage): Promise<void> {
  const result = await page.evaluate(`
    (() => ({
      href: location.href,
      title: document.title || '',
      bodyText: (document.body?.innerText || '').slice(0, 400),
    }))()
  `) as { href?: string; title?: string; bodyText?: string };

  if (/登录|统一认证/.test(result.bodyText || '')) {
    throw new CommandExecutionError('Please log in to in.iflytek.com before creating a repair request');
  }
}

async function openTemplate(page: IPage, template: RepairTemplate): Promise<void> {
  const meta = getRepairTemplateMeta(template);
  const url = `https://itsmsdp.iflytek.com/WorkOrder.do?woMode=newWO&from=Templates&module=incident&reqTemplate=${meta.reqTemplate}&requestServiceId=-1`;
  try {
    await page.goto(url);
  } catch {
    // Same target-switch race as other shared session navigations.
  }
  await page.wait(2);

  const state = await page.evaluate(`
    (() => ({
      href: location.href,
      bodyText: (document.body?.innerText || '').slice(0, 800),
    }))()
  `) as { href?: string; bodyText?: string };

  if (!state.href?.includes('WorkOrder.do')) {
    throw new CommandExecutionError(`Could not open repair template: ${meta.label}`);
  }
}

async function setInputValue(page: IPage, selector: string, fieldName: string, value: string): Promise<void> {
  const ok = await page.evaluate(`
    (() => {
      const selector = ${JSON.stringify(selector)};
      const value = ${JSON.stringify(value)};
      const input = document.querySelector(selector);
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    })()
  `);

  if (!ok) throw new CommandExecutionError(`Could not fill field: ${fieldName}`);
}

async function readRequiredLookupFields(page: IPage): Promise<RequiredLookupField[]> {
  const fields = await page.evaluate(`
    (() => {
      const $ = window.jQuery || window.$;
      return Array.from(document.querySelectorAll('.fafr-row')).flatMap((row) => {
        const label = row.querySelector('label span:last-child')?.textContent?.trim() || '';
        const isRequired = !!row.querySelector('.mandatory');
        const input = row.querySelector('input[name][data-type="lookup"], select[name][data-type="lookup"]');
        if (!isRequired || !input || !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return [];
        const select2 = $ ? $(input).data('select2') : null;
        const options = Array.isArray(select2?.opts?.data)
          ? select2.opts.data
              .map((option) => ({ id: String(option.id ?? ''), name: String(option.name ?? option.text ?? option.id ?? '').trim() }))
              .filter((option) => option.id || option.name)
          : [];
        return [{
          name: input.name,
          label,
          options,
        }];
      });
    })()
  `) as RequiredLookupField[];

  return fields;
}

async function selectLookupField(page: IPage, field: RequiredLookupField, requestedValue: string): Promise<void> {
  const option = resolveLookupOption(field.options, requestedValue);
  if (!option || option.id === '0') {
    const optionNames = formatLookupOptionNames(field.options);
    throw new CommandExecutionError(
      optionNames
        ? `Unknown value for ${field.label}: ${requestedValue}. 可选值: ${optionNames}`
        : `Unknown value for ${field.label}: ${requestedValue}`,
    );
  }

  const ok = await page.evaluate(`
    (() => {
      const fieldName = ${JSON.stringify(field.name)};
      const option = ${JSON.stringify(option)};
      const input = document.querySelector('[name="' + fieldName + '"]');
      const $ = window.jQuery || window.$;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement) || !$) return false;
      $(input).select2('data', option);
      $(input).val(String(option.id)).trigger('change');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    })()
  `);

  if (!ok) throw new CommandExecutionError(`Could not fill field: ${field.label}`);
}

async function fillRequiredLookupFields(page: IPage, options: CreateRepairOptions): Promise<void> {
  const lookupFields = await readRequiredLookupFields(page);
  if (!lookupFields.length) return;

  const requestedValues = [options.category, options.subcategory].filter((value): value is string => Boolean(value));
  const categoryLikeFields = lookupFields.filter((field) => /分类/.test(field.label));
  const fieldsToFill = categoryLikeFields.length ? categoryLikeFields : lookupFields;

  for (let index = 0; index < fieldsToFill.length; index += 1) {
    const field = fieldsToFill[index];
    const requestedValue = requestedValues[index];
    const onlyPlaceholder = field.options.filter((option) => option.id !== '0').length === 0;
    if (onlyPlaceholder) continue;
    if (!requestedValue) {
      throw new CommandExecutionError(buildMissingLookupFieldMessage(field));
    }
    await selectLookupField(page, field, requestedValue);
  }
}

async function setDescription(page: IPage, value: string): Promise<void> {
  const ok = await page.evaluate(`
    (() => {
      const value = ${JSON.stringify(value)};
      const textarea = document.querySelector('#form_req-form_description, textarea[name="description"]');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
        textarea.value = value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      return false;
    })()
  `);

  if (!ok) throw new CommandExecutionError('Could not fill field: 描述');
}

async function submitRepair(page: IPage): Promise<void> {
  const clicked = await page.evaluate(`
    (() => {
      const button = [...document.querySelectorAll('button,a,input')]
        .find((node) => {
          const text = (node.textContent || (node instanceof HTMLInputElement ? node.value : '') || '').trim();
          return text.includes('提交我的请求') || text.includes('添加请求');
        });
      if (!button) return false;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    })()
  `);

  if (!clicked) throw new CommandExecutionError('Could not submit the repair request');
  await page.wait(3);
}

async function readRepairSubmissionResult(page: IPage, options: CreateRepairOptions): Promise<RepairResult> {
  const result = await page.evaluate(`
    (() => {
      const text = document.body?.innerText || '';
      const requestIdMatch = text.match(/(REQ[-:]?\\s*\\w+|请求编号[:：]?\\s*\\w+|工单号[:：]?\\s*\\w+)/);
      return {
        href: location.href,
        text: text.slice(0, 1200),
        requestId: requestIdMatch ? requestIdMatch[0].split(/[:：]/).pop()?.trim() : '',
      };
    })()
  `) as { href?: string; text?: string; requestId?: string };

  if (/失败|错误|必填/.test(result.text || '')) {
    throw new CommandExecutionError(result.text || 'Repair request submission failed');
  }

  if (!result.requestId && result.href?.includes('WorkOrder.do?woMode=newWO')) {
    throw new CommandExecutionError('Repair request submission could not be verified');
  }

  return {
    status: 'submitted',
    template: options.template,
    title: options.title,
    location: options.location,
    phone: options.phone,
    requestId: result.requestId || '-',
  };
}

export async function createIflytekRepair(page: IPage, options: CreateRepairOptions): Promise<RepairResult> {
  await navigateToRepairTemplates(page);
  await ensureRepairSession(page);
  await openTemplate(page, options.template);
  await setInputValue(page, '#for_udf_fields\\.udf_sline_303, input[name="udf_fields.udf_sline_303"]', '我当前位置', options.location);
  await setInputValue(page, '#for_udf_fields\\.udf_long_304, input[name="udf_fields.udf_long_304"]', '电话号码', options.phone);
  await setInputValue(page, '#for_subject, input[name="subject"]', '主题', options.title);
  await setDescription(page, options.description);
  await fillRequiredLookupFields(page, options);
  await submitRepair(page);
  return await readRepairSubmissionResult(page, options);
}
