import { describe, expect, it } from 'vitest';
import {
  formatRepairResult,
  formatLookupOptionNames,
  getRepairTemplateMeta,
  normalizeRepairTemplate,
  resolveLookupOption,
} from './utils.js';

describe('normalizeRepairTemplate', () => {
  it('maps the public template keys to internal values', () => {
    expect(normalizeRepairTemplate('it')).toBe('it');
    expect(normalizeRepairTemplate('finance')).toBe('finance');
    expect(normalizeRepairTemplate('property')).toBe('property');
  });

  it('rejects unsupported templates', () => {
    expect(() => normalizeRepairTemplate('other')).toThrow('Unsupported repair template');
  });
});

describe('getRepairTemplateMeta', () => {
  it('returns the visible Chinese template label', () => {
    expect(getRepairTemplateMeta('it').label).toBe('IT报修');
    expect(getRepairTemplateMeta('finance').label).toBe('财务报修');
    expect(getRepairTemplateMeta('property').label).toBe('行政物业报修');
  });
});

describe('formatRepairResult', () => {
  it('formats a successful repair submission for CLI output', () => {
    expect(formatRepairResult({
      status: 'submitted',
      template: 'finance',
      title: '门锁坏了',
      location: 'A1北区3楼',
      phone: '13800000000',
      requestId: 'REQ-1',
    })).toEqual([{
      Status: 'submitted',
      Template: 'finance',
      Title: '门锁坏了',
      Location: 'A1北区3楼',
      Phone: '13800000000',
      RequestId: 'REQ-1',
    }]);
  });
});

describe('resolveLookupOption', () => {
  const options = [
    { id: '0', name: '没有指定' },
    { id: '619', name: '财务系统运维类' },
    { id: '627', name: '其他财务系统' },
  ];

  it('matches an option by visible name', () => {
    expect(resolveLookupOption(options, '财务系统运维类')).toEqual({ id: '619', name: '财务系统运维类' });
  });

  it('matches an option by normalized partial text', () => {
    expect(resolveLookupOption(options, '财务系统')).toEqual({ id: '619', name: '财务系统运维类' });
  });

  it('matches an option by option id', () => {
    expect(resolveLookupOption(options, '627')).toEqual({ id: '627', name: '其他财务系统' });
  });
});

describe('formatLookupOptionNames', () => {
  it('omits the placeholder option from help text', () => {
    expect(formatLookupOptionNames([
      { id: '0', name: '没有指定' },
      { id: '619', name: '财务系统运维类' },
      { id: '627', name: '其他财务系统' },
    ])).toBe('财务系统运维类 / 其他财务系统');
  });
});
