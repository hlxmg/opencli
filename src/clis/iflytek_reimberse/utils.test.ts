import { describe, expect, it } from 'vitest';
import {
  buildCreateDraftUrl,
  extractDraftContext,
  formatPendingFees,
  selectCostCenterOption,
  isIflytekReimberseReady,
  normalizePendingFeesResponse,
  selectDepartmentOption,
  type IflytekReimberseCostCenterOption,
  summarizePendingFees,
  type IflytekReimberseDepartmentOption,
  type IflytekReimbersePendingFee,
} from './utils.js';

function fee(overrides: Partial<IflytekReimbersePendingFee> = {}): IflytekReimbersePendingFee {
  return {
    id: 1,
    chargeType: '打车费',
    amount: 17.2,
    createTime: '2026-01-13 01:30:58',
    account: 'shuaili27',
    owner: '李帅',
    detail: '合肥市, 天源迪科科技园-南2门 ~ 讯飞小镇A1-东门 用车方式：快车',
    raw: {},
    ...overrides,
  };
}

function department(overrides: Partial<IflytekReimberseDepartmentOption> = {}): IflytekReimberseDepartmentOption {
  return {
    departmentId: 'ORG001',
    departmentName: 'AI资源部',
    costcenterName: 'AI资源部',
    costcenterEasid: 'CC001',
    costcenterCode: 'CC-CODE-1',
    companyName: '科大讯飞',
    companyEasid: 'COMP001',
    companyCode: 'COMP-CODE-1',
    raw: {},
    ...overrides,
  };
}

function costCenter(overrides: Partial<IflytekReimberseCostCenterOption> = {}): IflytekReimberseCostCenterOption {
  return {
    costcenterName: 'AI资源部',
    costcenterEasid: 'CC001',
    costcenterCode: 'CC-CODE-1',
    companyName: '科大讯飞',
    companyEasid: 'COMP001',
    companyCode: 'COMP-CODE-1',
    raw: {},
    ...overrides,
  };
}

describe('isIflytekReimberseReady', () => {
  it('returns true when the reimbursement list page is visible', () => {
    expect(isIflytekReimberseReady({
      href: 'http://in.iflytek.com/reimburse/requisition/toListRequisition',
      bodyText: '你好，李帅 未报销的费用 未提交的报销单 审批中的报销单',
    })).toBe(true);
  });

  it('returns false when the page is not yet in the reimbursement app', () => {
    expect(isIflytekReimberseReady({
      href: 'https://in.iflytek.com/',
      bodyText: '内部门户 我要报销',
    })).toBe(false);
  });
});

describe('normalizePendingFeesResponse', () => {
  it('normalizes raw portal rows into typed pending fees', () => {
    const normalized = normalizePendingFeesResponse({
      total: 2,
      list: [
        {
          id: 7708374,
          chargeType: '打车费',
          money: 17.2,
          gmtCreate: '2026-01-13 01:30:58',
          agentAccount: 'shuaili27',
          agentUser: '李帅',
          displayJson: {
            detail: '路线A',
          },
        },
        {
          id: 7705275,
          chargeType: '打车费',
          actMoney: 19.3,
          gmtCreate: '2026-01-11 01:30:33',
          createAccount: 'shuaili27',
          createUser: '李帅',
          displayDetail: '{"detail":"路线B"}',
        },
      ],
    });

    expect(normalized.total).toBe(2);
    expect(normalized.fees).toEqual([
      fee({
        id: 7708374,
        amount: 17.2,
        createTime: '2026-01-13 01:30:58',
        detail: '路线A',
        raw: {
          id: 7708374,
          chargeType: '打车费',
          money: 17.2,
          gmtCreate: '2026-01-13 01:30:58',
          agentAccount: 'shuaili27',
          agentUser: '李帅',
          displayJson: { detail: '路线A' },
        },
      }),
      fee({
        id: 7705275,
        amount: 19.3,
        createTime: '2026-01-11 01:30:33',
        detail: '路线B',
        raw: {
          id: 7705275,
          chargeType: '打车费',
          actMoney: 19.3,
          gmtCreate: '2026-01-11 01:30:33',
          createAccount: 'shuaili27',
          createUser: '李帅',
          displayDetail: '{"detail":"路线B"}',
        },
      }),
    ]);
  });

  it('treats missing lists as an empty response', () => {
    const normalized = normalizePendingFeesResponse({});

    expect(normalized.total).toBe(0);
    expect(normalized.fees).toEqual([]);
  });
});

describe('summarizePendingFees', () => {
  it('computes count and total amount', () => {
    const summary = summarizePendingFees([
      fee({ amount: 17.2 }),
      fee({ id: 2, amount: 19.3 }),
      fee({ id: 3, amount: 13.7 }),
    ]);

    expect(summary).toEqual({
      count: 3,
      totalAmount: 50.2,
    });
  });
});

describe('formatPendingFees', () => {
  it('maps pending fees into CLI-friendly rows', () => {
    const rows = formatPendingFees([
      fee(),
      fee({ id: 2, amount: 19.3, detail: '路线B', createTime: '2026-01-11 01:30:33' }),
    ]);

    expect(rows).toEqual([
      {
        ID: 1,
        Type: '打车费',
        Amount: '17.20',
        Created: '2026-01-13 01:30:58',
        Owner: '李帅',
        Detail: '合肥市, 天源迪科科技园-南2门 ~ 讯飞小镇A1-东门 用车方式：快车',
      },
      {
        ID: 2,
        Type: '打车费',
        Amount: '19.30',
        Created: '2026-01-11 01:30:33',
        Owner: '李帅',
        Detail: '路线B',
      },
    ]);
  });
});

describe('extractDraftContext', () => {
  it('builds create-draft context from the current fee list', () => {
    const context = extractDraftContext([
      fee({ id: 1, amount: 17.2 }),
      fee({ id: 2, amount: 19.3 }),
    ]);

    expect(context).toEqual({
      ids: [1, 2],
      agentAccount: 'shuaili27',
      agentUser: '李帅',
      totalAmount: 36.5,
    });
  });
});

describe('buildCreateDraftUrl', () => {
  it('builds the reimbursement create URL from the draft context', () => {
    const url = buildCreateDraftUrl({
      ids: [1, 2, 3],
      agentAccount: 'shuaili27',
      agentUser: '李帅',
      totalAmount: 50.2,
    });

    expect(url).toBe('http://in.iflytek.com/reimburse/requisition/create?ids=1,2,3,&type=1&agentAccount=shuaili27&agentUser=%E6%9D%8E%E5%B8%85&isStandard=0');
  });
});

describe('selectDepartmentOption', () => {
  it('prefers exact department id matches', () => {
    const selected = selectDepartmentOption([
      department(),
      department({ departmentId: 'ORG002', departmentName: 'AI工程院' }),
    ], 'ORG002');

    expect(selected.departmentName).toBe('AI工程院');
  });

  it('falls back to exact department name matches', () => {
    const selected = selectDepartmentOption([
      department(),
      department({ departmentId: 'ORG002', departmentName: 'AI工程院' }),
    ], 'AI资源部');

    expect(selected.departmentId).toBe('ORG001');
  });

  it('accepts unique fuzzy matches', () => {
    const selected = selectDepartmentOption([
      department(),
      department({ departmentId: 'ORG002', departmentName: 'AI工程院' }),
    ], '工程');

    expect(selected.departmentId).toBe('ORG002');
  });

  it('throws when fuzzy matching is ambiguous', () => {
    expect(() => selectDepartmentOption([
      department({ departmentName: 'AI资源部' }),
      department({ departmentId: 'ORG002', departmentName: 'AI资源平台部' }),
    ], 'AI资源')).toThrow('Multiple departments matched');
  });
});

describe('selectCostCenterOption', () => {
  it('prefers exact cost center id matches', () => {
    const selected = selectCostCenterOption([
      costCenter(),
      costCenter({ costcenterEasid: 'CC002', costcenterName: '讯飞研究院' }),
    ], 'CC002');

    expect(selected.costcenterName).toBe('讯飞研究院');
  });

  it('falls back to exact cost center name matches', () => {
    const selected = selectCostCenterOption([
      costCenter(),
      costCenter({ costcenterEasid: 'CC002', costcenterName: '讯飞研究院' }),
    ], 'AI资源部');

    expect(selected.costcenterEasid).toBe('CC001');
  });

  it('accepts unique fuzzy matches', () => {
    const selected = selectCostCenterOption([
      costCenter(),
      costCenter({ costcenterEasid: 'CC002', costcenterName: '讯飞研究院' }),
    ], '研究');

    expect(selected.costcenterEasid).toBe('CC002');
  });
});
