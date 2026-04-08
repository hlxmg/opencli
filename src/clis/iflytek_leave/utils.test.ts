import { describe, expect, it } from 'vitest';
import {
  formatIflytekLeaveDraftResult,
  normalizeIflytekLeaveDateInput,
  normalizeIflytekLeaveMatchText,
} from './utils.js';

describe('normalizeIflytekLeaveDateInput', () => {
  it('accepts a plain date', () => {
    expect(normalizeIflytekLeaveDateInput('2026-04-05')).toEqual({
      calendarTitle: '2026-4-5',
      isoDate: '2026-04-05',
    });
  });

  it('accepts a datetime-like value and keeps the date part', () => {
    expect(normalizeIflytekLeaveDateInput('2026-04-05 09:30')).toEqual({
      calendarTitle: '2026-4-5',
      isoDate: '2026-04-05',
    });
  });

  it('rejects unsupported date formats', () => {
    expect(() => normalizeIflytekLeaveDateInput('04/05/2026')).toThrow('Unsupported leave date');
  });
});

describe('normalizeIflytekLeaveMatchText', () => {
  it('removes all whitespace for browser-option matching', () => {
    expect(normalizeIflytekLeaveMatchText(' 张 凯博 \n')).toBe('张凯博');
  });
});

describe('formatIflytekLeaveDraftResult', () => {
  it('formats the draft result for CLI output', () => {
    expect(formatIflytekLeaveDraftResult({
      approver: '张凯博',
      duration: '8',
      end: '2026-04-06',
      reason: '本人有事',
      requestId: '9470570',
      start: '2026-04-05',
      status: 'saved',
      type: '事假',
      url: 'https://oa.iflytek.com/spa/workflow/static4form/index.html#/main/workflow/req?requestid=9470570',
    })).toEqual([{
      Status: 'saved',
      Type: '事假',
      Reason: '本人有事',
      Start: '2026-04-05',
      End: '2026-04-06',
      Duration: '8',
      Approver: '张凯博',
      RequestId: '9470570',
      URL: 'https://oa.iflytek.com/spa/workflow/static4form/index.html#/main/workflow/req?requestid=9470570',
    }]);
  });
});
