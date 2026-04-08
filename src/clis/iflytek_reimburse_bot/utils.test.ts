import { describe, expect, it } from 'vitest';
import {
  filterIflytekReimburseBotPendingRecordsByType,
  formatIflytekReimburseBotDraftResult,
  formatIflytekReimburseBotPendingRecords,
  hasIflytekReimburseBotProjectSelection,
  isIflytekReimburseBotDraftEditor,
  isIflytekReimburseBotProjectModalCandidate,
  isIflytekReimburseBotReady,
  normalizeIflytekReimburseBotDraftResult,
  normalizeIflytekReimburseBotPendingCandidates,
  normalizeIflytekReimburseBotPendingText,
  normalizeIflytekReimburseBotTypeFilter,
  normalizeIflytekReimburseBotProjectCode,
  selectIflytekReimburseBotProjectRow,
  selectIflytekReimburseBotPendingRecords,
  summarizeIflytekReimburseBotPendingRecords,
  type RawIflytekReimburseBotPendingCandidate,
} from './utils.js';

function candidate(overrides: Partial<RawIflytekReimburseBotPendingCandidate> = {}): RawIflytekReimburseBotPendingCandidate {
  return {
    title: '加班交通费',
    amountText: '¥17.20',
    status: '未报销',
    happenedAt: '2026-01-12 09:03:38',
    detail: '天源迪科科技园-南2门 -> 讯飞小镇A1-东门',
    source: '滴滴平台',
    visible: true,
    ...overrides,
  };
}

describe('isIflytekReimburseBotReady', () => {
  it('returns true when the reimburse bot home shell is visible', () => {
    expect(isIflytekReimburseBotReady({
      href: 'https://bzjqr.iflytek.com/ecs-console/index.html#/home',
      bodyText: '待处理 215.86 待报销（元） 0 审批中单据 常用功能 费用报销',
    })).toBe(true);
  });

  it('returns false for unrelated pages', () => {
    expect(isIflytekReimburseBotReady({
      href: 'https://bzjqr.iflytek.com/login',
      bodyText: '统一认证平台 扫码登录',
    })).toBe(false);
  });
});

describe('isIflytekReimburseBotDraftEditor', () => {
  it('returns true on an unsubmitted reimbursement draft page', () => {
    expect(isIflytekReimburseBotDraftEditor({
      href: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor?id=1',
      bodyText: '对私费用报销单 未提交 BZ-DSBX202604070307 项目编码 保 存 提 交',
    })).toBe(true);
  });

  it('returns false on other pages', () => {
    expect(isIflytekReimburseBotDraftEditor({
      href: 'https://bzjqr.iflytek.com/ecs-console/index.html#/home',
      bodyText: '待报销（元） 审批中单据',
    })).toBe(false);
  });
});

describe('normalizeIflytekReimburseBotPendingCandidates', () => {
  it('normalizes visible unreimbursed rows and parses amounts', () => {
    const rows = normalizeIflytekReimburseBotPendingCandidates([
      candidate(),
      candidate({
        title: '年会、 发布会等活动',
        amountText: '90.36',
        happenedAt: '2026-01-10 18:00:00',
        detail: '活动打车',
        source: '企业支付',
      }),
    ]);

    expect(rows).toEqual([
      {
        title: '加班交通费',
        amount: 17.2,
        status: '未报销',
        happenedAt: '2026-01-12 09:03:38',
        detail: '天源迪科科技园-南2门 -> 讯飞小镇A1-东门',
        source: '滴滴平台',
        visible: true,
      },
      {
        title: '年会、 发布会等活动',
        amount: 90.36,
        status: '未报销',
        happenedAt: '2026-01-10 18:00:00',
        detail: '活动打车',
        source: '企业支付',
        visible: true,
      },
    ]);
  });

  it('drops rows without title or amount', () => {
    const rows = normalizeIflytekReimburseBotPendingCandidates([
      candidate({ title: '' }),
      candidate({ amountText: '' }),
      candidate({ title: '加班交通费', amountText: '17.20' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(17.2);
  });
});

describe('normalizeIflytekReimburseBotPendingText', () => {
  it('parses unreimbursed rows from page body text as a fallback', () => {
    const rows = normalizeIflytekReimburseBotPendingText(`
      发票夹
      我的支出记录
      创建报销单
      加班交通费
      ¥17.20
      滴滴平台
      2026-01-12 09:03:38
      未报销
      年会、 发布会等活动
      90.36
      企业支付
      2026-01-10 18:00:00
      未报销
    `);

    expect(rows).toEqual([
      {
        title: '加班交通费',
        amount: 17.2,
        status: '未报销',
        happenedAt: '2026-01-12 09:03:38',
        detail: '',
        source: '滴滴平台',
        visible: true,
      },
      {
        title: '年会、 发布会等活动',
        amount: 90.36,
        status: '未报销',
        happenedAt: '2026-01-10 18:00:00',
        detail: '',
        source: '企业支付',
        visible: true,
      },
    ]);
  });
});

describe('selectIflytekReimburseBotPendingRecords', () => {
  it('keeps only visible unreimbursed rows', () => {
    const rows = selectIflytekReimburseBotPendingRecords([
      ...normalizeIflytekReimburseBotPendingCandidates([
        candidate(),
        candidate({ status: '报销中', amountText: '19.30' }),
        candidate({ visible: false, amountText: '13.70' }),
      ]),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('加班交通费');
  });

  it('throws when no pending records are available', () => {
    expect(() => selectIflytekReimburseBotPendingRecords([])).toThrow('No pending reimbursement records were found');
  });
});

describe('normalizeIflytekReimburseBotTypeFilter', () => {
  it('trims the type filter', () => {
    expect(normalizeIflytekReimburseBotTypeFilter('  加班交通费  ')).toBe('加班交通费');
  });

  it('returns undefined for empty filters', () => {
    expect(normalizeIflytekReimburseBotTypeFilter('   ')).toBeUndefined();
  });
});

describe('filterIflytekReimburseBotPendingRecordsByType', () => {
  it('keeps all records when no type filter is provided', () => {
    const records = normalizeIflytekReimburseBotPendingCandidates([
      candidate(),
      candidate({ title: '年会、 发布会等活动', amountText: '90.36' }),
    ]);

    expect(filterIflytekReimburseBotPendingRecordsByType(records)).toHaveLength(2);
  });

  it('filters records by matching type title', () => {
    const records = normalizeIflytekReimburseBotPendingCandidates([
      candidate(),
      candidate({ title: '年会、 发布会等活动', amountText: '90.36' }),
    ]);

    expect(filterIflytekReimburseBotPendingRecordsByType(records, '加班交通费')).toEqual([
      {
        title: '加班交通费',
        amount: 17.2,
        status: '未报销',
        happenedAt: '2026-01-12 09:03:38',
        detail: '天源迪科科技园-南2门 -> 讯飞小镇A1-东门',
        source: '滴滴平台',
        visible: true,
      },
    ]);
  });

  it('throws when the type filter matches nothing', () => {
    const records = normalizeIflytekReimburseBotPendingCandidates([
      candidate(),
      candidate({ title: '年会、 发布会等活动', amountText: '90.36' }),
    ]);

    expect(() => filterIflytekReimburseBotPendingRecordsByType(records, '住宿费')).toThrow(
      'No pending reimbursement records matched type: 住宿费',
    );
  });
});

describe('summarizeIflytekReimburseBotPendingRecords', () => {
  it('computes count and total amount', () => {
    expect(summarizeIflytekReimburseBotPendingRecords(
      normalizeIflytekReimburseBotPendingCandidates([
        candidate({ amountText: '17.20' }),
        candidate({ amountText: '19.30' }),
        candidate({ amountText: '13.70' }),
      ]),
    )).toEqual({
      count: 3,
      totalAmount: 50.2,
    });
  });
});

describe('formatIflytekReimburseBotPendingRecords', () => {
  it('maps pending rows into CLI-friendly output', () => {
    const rows = formatIflytekReimburseBotPendingRecords(normalizeIflytekReimburseBotPendingCandidates([
      candidate(),
      candidate({
        title: '年会、 发布会等活动',
        amountText: '90.36',
        detail: '活动打车',
        source: '企业支付',
      }),
    ]));

    expect(rows).toEqual([
      {
        Type: '加班交通费',
        Amount: '17.20',
        Status: '未报销',
        HappenedAt: '2026-01-12 09:03:38',
        Source: '滴滴平台',
        Detail: '天源迪科科技园-南2门 -> 讯飞小镇A1-东门',
      },
      {
        Type: '年会、 发布会等活动',
        Amount: '90.36',
        Status: '未报销',
        HappenedAt: '2026-01-12 09:03:38',
        Source: '企业支付',
        Detail: '活动打车',
      },
    ]);
  });
});

describe('normalizeIflytekReimburseBotProjectCode', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeIflytekReimburseBotProjectCode('  XM-2026-001  ')).toBe('XM-2026-001');
  });

  it('rejects empty project codes', () => {
    expect(() => normalizeIflytekReimburseBotProjectCode('   ')).toThrow('project code is required');
  });
});

describe('hasIflytekReimburseBotProjectSelection', () => {
  it('accepts pages that still show the explicit project code', () => {
    expect(hasIflytekReimburseBotProjectSelection(
      '对私费用报销单 项目编码 T-260300006 报销事由',
      'T-260300006',
    )).toBe(true);
  });

  it('accepts live saved pages that only show the project name next to 项目编码', () => {
    expect(hasIflytekReimburseBotProjectSelection(
      '对私费用报销单 项目编码 智能收单 - 报销事由',
      'T-260300006',
    )).toBe(true);
  });

  it('rejects pages where the 项目编码 section is still blank', () => {
    expect(hasIflytekReimburseBotProjectSelection(
      '对私费用报销单 项目编码 - 报销事由',
      'T-260300006',
    )).toBe(false);
  });
});

describe('normalizeIflytekReimburseBotDraftResult', () => {
  it('normalizes a saved draft result', () => {
    expect(normalizeIflytekReimburseBotDraftResult({
      href: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor?id=BX202604070001',
      projectCode: 'XM-2026-001',
      selectedCount: 7,
      bodyText: '对私费用报销单 BZ-DSBX202604070218 项目编码 XM-2026-001 保 存 提 交',
      toastText: '保存成功',
    })).toEqual({
      status: 'saved',
      type: 'ALL',
      projectCode: 'XM-2026-001',
      recordCount: 7,
      billNo: 'BZ-DSBX202604070218',
      url: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor?id=BX202604070001',
    });
  });

  it('throws when save success cannot be verified', () => {
    expect(() => normalizeIflytekReimburseBotDraftResult({
      href: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor',
      projectCode: 'XM-2026-001',
      selectedCount: 7,
      bodyText: '对私费用报销单 项目编码 XM-2026-001',
      toastText: '',
    })).toThrow('Could not verify the reimbursement draft was saved');
  });

  it('accepts saved drafts when the page only shows the selected project name', () => {
    expect(normalizeIflytekReimburseBotDraftResult({
      href: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor?id=BX202604070001',
      projectCode: 'T-260300006',
      selectedCount: 7,
      bodyText: '对私费用报销单 BZ-DSBX202604070218 项目编码 智能收单 - 报销事由 保 存 提 交',
      toastText: '',
    })).toEqual({
      status: 'saved',
      type: 'ALL',
      projectCode: 'T-260300006',
      recordCount: 7,
      billNo: 'BZ-DSBX202604070218',
      url: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor?id=BX202604070001',
    });
  });
});

describe('isIflytekReimburseBotProjectModalCandidate', () => {
  it('accepts fallback modals without a 项目编码 title when they still expose query controls', () => {
    expect(isIflytekReimburseBotProjectModalCandidate({
      text: '查询 重置 T-260300006 费用类项目',
      visible: true,
      hasSearchInput: true,
      hasQueryButton: true,
      hasResultRows: true,
    })).toBe(true);
  });

  it('rejects unrelated visible overlays', () => {
    expect(isIflytekReimburseBotProjectModalCandidate({
      text: '保存成功',
      visible: true,
      hasSearchInput: false,
      hasQueryButton: false,
      hasResultRows: false,
    })).toBe(false);
  });
});

describe('selectIflytekReimburseBotProjectRow', () => {
  it('prefers the 费用 project row over unrelated matches', () => {
    expect(selectIflytekReimburseBotProjectRow([
      'T-260300006 研发费用 外包服务费',
      'T-260300006 研发费用 差旅费用',
      'T-260300006 行政项目',
    ], 'T-260300006')).toBe('T-260300006 研发费用 差旅费用');
  });

  it('throws when multiple matching rows remain ambiguous', () => {
    expect(() => selectIflytekReimburseBotProjectRow([
      'T-260300006 项目A 费用归集',
      'T-260300006 项目B 费用归集',
    ], 'T-260300006')).toThrow('Multiple project code options matched: T-260300006');
  });

  it('keeps the 费用(不含外包服务费) row as the preferred live option', () => {
    expect(selectIflytekReimburseBotProjectRow([
      '1 T-260300006.05 外包服务费 T-260300006 星火数字员工平台',
      '2 T-260300006.03 费用(不含外包服务费) T-260300006 星火数字员工平台',
    ], 'T-260300006')).toBe('2 T-260300006.03 费用(不含外包服务费) T-260300006 星火数字员工平台');
  });
});

describe('formatIflytekReimburseBotDraftResult', () => {
  it('maps the saved draft into CLI output rows', () => {
    expect(formatIflytekReimburseBotDraftResult({
      status: 'saved',
      type: '加班交通费',
      projectCode: 'T-260300006',
      recordCount: 2,
      billNo: 'BZ-DSBX202604070218',
      url: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor?id=BX202604070001',
    })).toEqual([{
      Status: 'saved',
      Type: '加班交通费',
      ProjectCode: 'T-260300006',
      RecordCount: '2',
      BillNo: 'BZ-DSBX202604070218',
      URL: 'https://bzjqr.iflytek.com/fssc/#/api/expenserecord/billeditor?id=BX202604070001',
    }]);
  });
});
