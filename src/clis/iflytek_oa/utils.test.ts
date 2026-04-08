import { describe, expect, it } from 'vitest';
import {
  approveIflytekOaTodo,
  extractIflytekOaFlowIdFromUrl,
  filterIflytekOaTodosByCategory,
  formatIflytekOaApprovalResult,
  formatIflytekOaPendingTodos,
  formatIflytekOaTodoDetail,
  getIflytekOaTodoDetail,
  findIflytekOaTodoByFlowId,
  listIflytekOaDoneTodos,
  normalizeIflytekOaApprovalAction,
  normalizeIflytekOaPendingTodos,
  normalizeIflytekOaPageItems,
  type IflytekOaPageState,
  selectIflytekOaTodosFromPageItems,
  type IflytekOaPendingTodo,
  type RawIflytekOaPageItem,
  type RawIflytekOaTodoCandidate,
} from './utils.js';

function candidate(overrides: Partial<RawIflytekOaTodoCandidate> = {}): RawIflytekOaTodoCandidate {
  return {
    title: '报销审批',
    text: '待办 报销审批 张三 2026-04-03 10:30',
    url: 'http://in.iflytek.com/workflow/detail/1',
    ...overrides,
  };
}

describe('normalizeIflytekOaPendingTodos', () => {
  it('keeps pending-style todo items and extracts key fields', () => {
    const todos = normalizeIflytekOaPendingTodos([
      candidate(),
    ]);

    expect(todos).toEqual([
      {
        flowId: '1',
        title: '报销审批',
        status: '待办',
        updatedAt: '2026-04-03 10:30',
        url: 'http://in.iflytek.com/workflow/detail/1',
        summary: '待办 报销审批 张三 2026-04-03 10:30',
        sender: '',
        category: '',
        source: '',
      },
    ]);
  });

  it('drops obvious non-pending items', () => {
    const todos = normalizeIflytekOaPendingTodos([
      candidate({ title: '已办事项', text: '已办 已办事项 李四 2026-04-03 11:00', url: 'http://in.iflytek.com/done/1' }),
      candidate(),
    ]);

    expect(todos.map((item) => item.title)).toEqual(['报销审批']);
  });

  it('deduplicates identical todo links', () => {
    const todos = normalizeIflytekOaPendingTodos([
      candidate(),
      candidate({ text: '待办 报销审批 张三 2026-04-03 10:30 审批中' }),
    ]);

    expect(todos).toHaveLength(1);
  });

  it('falls back to the first meaningful line when title is missing', () => {
    const todos = normalizeIflytekOaPendingTodos([
      candidate({
        title: '',
        text: '待办\n请假申请审批\n王五\n2026-04-03 09:00',
        url: 'http://in.iflytek.com/workflow/detail/2',
      }),
    ]);

    expect(todos[0]?.title).toBe('请假申请审批');
  });
});

describe('normalizeIflytekOaPageItems', () => {
  it('maps page items into structured todos and strips html from titles', () => {
    const todos = normalizeIflytekOaPageItems([
      {
        id: '1',
        title: '请假申请<b>（延时假）</b>',
        sendTime: '今天14:02',
        sendName: '李帅',
        category: '人事管理类',
        typeName: 'OA',
        businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
      },
    ]);

    expect(todos).toEqual([
      {
        flowId: '1',
        title: '请假申请（延时假）',
        status: '待办',
        updatedAt: '今天14:02',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
        summary: 'OA | 人事管理类 | 李帅',
        sender: '李帅',
        category: '人事管理类',
        source: 'OA',
      },
    ]);
  });

  it('filters out malformed items without a title or url', () => {
    const todos = normalizeIflytekOaPageItems([
      {
        id: '1',
        title: '',
        sendTime: '今天14:02',
        sendName: '李帅',
        category: '人事管理类',
        typeName: 'OA',
        businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
      },
      {
        id: '2',
        title: '正常待办',
        sendTime: '今天13:00',
        sendName: '王五',
        category: '绩效系统',
        typeName: '绩效管理',
        businessPcUrl: '',
      },
    ] satisfies RawIflytekOaPageItem[]);

    expect(todos).toEqual([]);
  });

  it('can label page items as done when used for processed records', () => {
    const todos = normalizeIflytekOaPageItems([
      {
        id: '1',
        title: '请假申请<b>（延时假）</b>',
        sendTime: '今天14:02',
        sendName: '李帅',
        category: '人事管理类',
        typeName: 'OA',
        businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
      },
    ], '已办');

    expect(todos).toEqual([
      {
        flowId: '1',
        title: '请假申请（延时假）',
        status: '已办',
        updatedAt: '今天14:02',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
        summary: 'OA | 人事管理类 | 李帅',
        sender: '李帅',
        category: '人事管理类',
        source: 'OA',
      },
    ]);
  });

  it('supports exact category filtering from unfiltered raw page items', () => {
    const todos = selectIflytekOaTodosFromPageItems([
      {
        id: '1',
        title: '请假申请',
        sendTime: '今天14:02',
        sendName: '李帅',
        category: '人事管理类',
        typeName: 'OA',
        businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
      },
      {
        id: '2',
        title: '计划制定',
        sendTime: '昨天18:53',
        sendName: '刘妍君',
        category: '绩效系统',
        typeName: '绩效管理',
        businessPcUrl: 'https://performance.iflytek.com/#/checkDetail?messageId=2',
      },
    ], 10, 'OA');

    expect(todos).toEqual([
      {
        flowId: '1',
        title: '请假申请',
        status: '待办',
        updatedAt: '今天14:02',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
        summary: 'OA | 人事管理类 | 李帅',
        sender: '李帅',
        category: '人事管理类',
        source: 'OA',
      },
    ]);
  });
});

describe('extractIflytekOaFlowIdFromUrl', () => {
  it('extracts requestid and messageId style flow ids from urls', () => {
    expect(extractIflytekOaFlowIdFromUrl('https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345')).toBe('12345');
    expect(extractIflytekOaFlowIdFromUrl('https://performance.iflytek.com/#/checkDetail?messageId=abc-9')).toBe('abc-9');
  });

  it('falls back to the trailing path segment when no query id exists', () => {
    expect(extractIflytekOaFlowIdFromUrl('https://bzjqr.iflytek.com/todo/42')).toBe('42');
  });
});

describe('formatIflytekOaPendingTodos', () => {
  it('includes FlowId in CLI rows', () => {
    expect(formatIflytekOaPendingTodos([
      {
        flowId: '12345',
        title: '请假申请',
        status: '待办',
        updatedAt: '今天14:02',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
        summary: 'OA | 人事管理类 | 李帅',
        sender: '李帅',
        category: '人事管理类',
        source: 'OA',
      },
    ])).toEqual([
      {
        FlowId: '12345',
        Title: '请假申请',
        Source: 'OA',
        Category: '人事管理类',
        Sender: '李帅',
        UpdatedAt: '今天14:02',
        URL: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
      },
    ]);
  });
});

describe('findIflytekOaTodoByFlowId', () => {
  it('matches a todo by explicit FlowId', () => {
    expect(findIflytekOaTodoByFlowId([
      {
        flowId: '12345',
        title: '请假申请',
        status: '待办',
        updatedAt: '今天14:02',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
        summary: 'OA | 人事管理类 | 李帅',
        sender: '李帅',
        category: '人事管理类',
        source: 'OA',
      },
    ], '12345')?.title).toBe('请假申请');
  });

  it('falls back to the id parsed from the todo URL', () => {
    expect(findIflytekOaTodoByFlowId([
      {
        flowId: '',
        title: '绩效审批',
        status: '已办',
        updatedAt: '昨天18:53',
        url: 'https://performance.iflytek.com/#/checkDetail?messageId=abc-9',
        summary: '绩效管理 | 季度考核 | 王五',
        sender: '王五',
        category: '季度考核',
        source: '绩效管理',
      },
    ], 'abc-9')?.title).toBe('绩效审批');
  });
});

describe('formatIflytekOaTodoDetail', () => {
  it('maps detail records into CLI rows', () => {
    expect(formatIflytekOaTodoDetail({
      title: '请假申请',
      status: '待办',
      flowId: '12345',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
      sender: '李帅',
      updatedAt: '今天14:02',
      detailText: '申请人 李帅 事由 年假',
    })).toEqual([{
      Title: '请假申请',
      Status: '待办',
      FlowId: '12345',
      URL: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
      Sender: '李帅',
      UpdatedAt: '今天14:02',
      DetailText: '申请人 李帅 事由 年假',
    }]);
  });
});

describe('normalizeIflytekOaApprovalAction', () => {
  it('accepts approve and reject actions with surrounding whitespace', () => {
    expect(normalizeIflytekOaApprovalAction('  approve  ')).toBe('approve');
    expect(normalizeIflytekOaApprovalAction('reject')).toBe('reject');
  });
});

describe('formatIflytekOaApprovalResult', () => {
  it('maps approval results into CLI rows', () => {
    expect(formatIflytekOaApprovalResult({
      title: '请假申请',
      action: 'approve',
      flowId: '12345',
      status: 'approved',
      message: '审批成功',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
    })).toEqual([{
      Title: '请假申请',
      Action: 'approve',
      FlowId: '12345',
      Status: 'approved',
      Message: '审批成功',
      URL: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
    }]);
  });
});

describe('getIflytekOaTodoDetail', () => {
  it('finds a pending todo by FlowId and reads the detail page text', async () => {
    const payload = {
      result: true,
      content: {
        pageInfo: {
          pages: 1,
          list: [
            {
              id: '12345',
              title: '请假申请',
              sendTime: '今天14:02',
              sendName: '李帅',
              category: '人事管理类',
              typeName: 'OA',
              businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
            },
          ],
        },
      },
    };

    const fakePage = {
      goto: async () => {},
      wait: async () => {},
      evaluate: async (script: string) => {
        if (script.includes('slice(0, 8000)')) {
          return {
            href: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
            title: '请假申请详情',
            bodyText: '请假申请 申请人 李帅 事由 年假 审批意见 同意',
          };
        }

        if (script.includes('slice(0, 2500)')) {
          return {
            href: 'https://in.iflytek.com/fornt/mhc/index#/000',
            title: '科大讯飞-统一待办',
            bodyText: '统一待办 待办',
          } satisfies IflytekOaPageState;
        }

        if (script.includes('getMhcInformation')) {
          return payload;
        }

        throw new Error(`Unexpected evaluate call: ${script.slice(0, 80)}`);
      },
    } as any;

    const detail = await getIflytekOaTodoDetail(fakePage, { id: '12345', status: 'pending' });

    expect(detail).toEqual({
      title: '请假申请',
      status: '待办',
      flowId: '12345',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
      sender: '李帅',
      updatedAt: '今天14:02',
      detailText: '请假申请 申请人 李帅 事由 年假 审批意见 同意',
    });
  });

  it('can resolve a done detail through DOM fallback when the list endpoint fails', async () => {
    const fakePage = {
      goto: async () => {},
      wait: async () => {},
      evaluate: async (script: string) => {
        if (script.includes('slice(0, 8000)')) {
          return {
            href: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=54321',
            title: '付款申请详情',
            bodyText: '付款申请 申请人 王五 审批意见 已归档',
          };
        }

        if (script.includes('slice(0, 2500)')) {
          return {
            href: 'https://in.iflytek.com/fornt/mhc/index#/000',
            title: '科大讯飞-统一待办',
            bodyText: '统一待办 已办',
          } satisfies IflytekOaPageState;
        }

        if (script.includes('getMhcInformation')) {
          throw new Error('backend unavailable');
        }

        if (script.includes('querySelectorAll(\'a[href]\')')) {
          return [{
            title: '付款申请',
            text: '已办 付款申请 王五 2026-04-03 18:53',
            url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=54321',
            flowId: '54321',
            status: '已办',
            updatedAt: '2026-04-03 18:53',
          }];
        }

        throw new Error(`Unexpected evaluate call: ${script.slice(0, 80)}`);
      },
    } as any;

    const detail = await getIflytekOaTodoDetail(fakePage, { id: '54321', status: 'done' });

    expect(detail).toEqual({
      title: '付款申请',
      status: '已办',
      flowId: '54321',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=54321',
      sender: '',
      updatedAt: '2026-04-03 18:53',
      detailText: '付款申请 申请人 王五 审批意见 已归档',
    });
  });
});

describe('approveIflytekOaTodo', () => {
  it('approves a pending todo by FlowId', async () => {
    const payload = {
      result: true,
      content: {
        pageInfo: {
          pages: 1,
          list: [
            {
              id: '12345',
              title: '请假申请',
              sendTime: '今天14:02',
              sendName: '李帅',
              category: '人事管理类',
              typeName: 'OA',
              businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
            },
          ],
        },
      },
    };

    const fakePage = {
      goto: async () => {},
      wait: async () => {},
      evaluate: async (script: string) => {
        if (script.includes('slice(0, 8000)')) {
          return {
            href: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
            title: '请假申请详情',
            bodyText: '请假申请 审批意见 同意',
          };
        }
        if (script.includes('slice(0, 2500)')) {
          return {
            href: 'https://in.iflytek.com/fornt/mhc/index#/000',
            title: '科大讯飞-统一待办',
            bodyText: '统一待办 待办',
          } satisfies IflytekOaPageState;
        }
        if (script.includes('getMhcInformation')) {
          return payload;
        }
        if (script.includes('__opencli_iflytek_oa_approval__')) {
          return {
            ok: true,
            status: 'approved',
            message: '审批成功',
            href: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
          };
        }
        throw new Error(`Unexpected evaluate call: ${script.slice(0, 80)}`);
      },
    } as any;

    await expect(approveIflytekOaTodo(fakePage, { id: '12345', action: 'approve' })).resolves.toEqual({
      title: '请假申请',
      action: 'approve',
      flowId: '12345',
      status: 'approved',
      message: '审批成功',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
    });
  });

  it('fails when the reject flow only opens a dialog without final submission', async () => {
    const payload = {
      result: true,
      content: {
        pageInfo: {
          pages: 1,
          list: [
            {
              id: '70650602',
              title: '采购申请',
              sendTime: '今天15:30',
              sendName: '王五',
              category: '采购类',
              typeName: 'OA',
              businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=70650602',
            },
          ],
        },
      },
    };

    const fakePage = {
      goto: async () => {},
      wait: async () => {},
      evaluate: async (script: string) => {
        if (script.includes('slice(0, 8000)')) {
          return {
            href: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=70650602',
            title: '采购申请详情',
            bodyText: '采购申请 审批意见',
          };
        }
        if (script.includes('slice(0, 2500)')) {
          return {
            href: 'https://in.iflytek.com/fornt/mhc/index#/000',
            title: '科大讯飞-统一待办',
            bodyText: '统一待办 待办',
          } satisfies IflytekOaPageState;
        }
        if (script.includes('getMhcInformation')) {
          return payload;
        }
        if (script.includes('__opencli_iflytek_oa_approval__')) {
          return {
            ok: true,
            submitted: false,
            status: 'rejected',
            message: '审批对话框已打开，但未找到最终提交按钮',
            href: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=70650602',
          };
        }
        throw new Error(`Unexpected evaluate call: ${script.slice(0, 80)}`);
      },
    } as any;

    await expect(
      approveIflytekOaTodo(fakePage, { id: '70650602', action: 'reject' }),
    ).rejects.toMatchObject({
      message: '审批对话框已打开，但未找到最终提交按钮',
    });
  });
});

describe('listIflytekOaDoneTodos', () => {
  it('uses the done status label when backend page items are returned', async () => {
    const payload = {
      result: true,
      content: {
        pageInfo: {
          pages: 1,
          list: [
            {
              id: '1',
              title: '请假申请<b>（延时假）</b>',
              sendTime: '今天14:02',
              sendName: '李帅',
              category: '人事管理类',
              typeName: 'OA',
              businessPcUrl: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
            },
          ],
        },
      },
    };

    const fakePage = {
      goto: async () => {},
      wait: async () => {},
      evaluate: async (script: string) => {
        if (script.includes('location.href')) {
          return {
            href: 'https://in.iflytek.com/fornt/mhc/index#/000',
            title: '科大讯飞-统一待办',
            bodyText: '统一待办 已办',
          } satisfies IflytekOaPageState;
        }

        if (script.includes('getMhcInformation')) {
          return payload;
        }

        throw new Error(`Unexpected evaluate call: ${script.slice(0, 80)}`);
      },
    } as any;

    const todos = await listIflytekOaDoneTodos(fakePage, 5);

    expect(todos).toEqual([
      {
        flowId: '1',
        title: '请假申请（延时假）',
        status: '已办',
        updatedAt: '今天14:02',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
        summary: 'OA | 人事管理类 | 李帅',
        sender: '李帅',
        category: '人事管理类',
        source: 'OA',
      },
    ]);
  });

  it('retries unfiltered pages until enough category-matched done items are collected', async () => {
    const filteredEmpty = {
      result: true,
      content: {
        pageInfo: {
          pages: 0,
          list: [],
        },
      },
    };
    const unfilteredPage1 = {
      result: true,
      content: {
        pageInfo: {
          pages: 2,
          list: Array.from({ length: 20 }, (_, index) => ({
            id: String(index + 1),
            title: `普通事项-${index + 1}`,
            sendTime: `03-${String(index + 1).padStart(2, '0')} 10:00`,
            sendName: '李帅',
            category: '人事管理类',
            typeName: index === 4 ? '报账机器人' : 'OA',
            businessPcUrl: `https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=${index + 1}`,
          })),
        },
      },
    };
    const unfilteredPage2 = {
      result: true,
      content: {
        pageInfo: {
          pages: 2,
          list: Array.from({ length: 12 }, (_, index) => ({
            id: String(index + 21),
            title: `机器人事项-${index + 21}`,
            sendTime: `02-${String(index + 1).padStart(2, '0')} 09:00`,
            sendName: '姚远',
            category: 'BUSINESS_FLOW',
            typeName: '报账机器人',
            businessPcUrl: `https://bzjqr.iflytek.com/todo/${index + 21}`,
          })),
        },
      },
    };

    const evaluateQueue: unknown[] = [
      {
        href: 'https://in.iflytek.com/fornt/mhc/index#/000',
        title: '科大讯飞-统一待办',
        bodyText: '统一待办 已办',
      } satisfies IflytekOaPageState,
      filteredEmpty,
      unfilteredPage1,
      unfilteredPage2,
    ];

    const fakePage = {
      goto: async () => {},
      wait: async () => {},
      evaluate: async () => {
        if (evaluateQueue.length === 0) throw new Error('Unexpected extra evaluate call');
        return evaluateQueue.shift();
      },
    } as any;

    const todos = await listIflytekOaDoneTodos(fakePage, 5, '报账机器人');

    expect(todos).toHaveLength(5);
    expect(todos.every((item) => item.source === '报账机器人')).toBe(true);
  });
});

describe('filterIflytekOaTodosByCategory', () => {
  function todo(overrides: Partial<IflytekOaPendingTodo> = {}): IflytekOaPendingTodo {
    return {
      title: '事项',
      status: '待办',
      updatedAt: '今天14:02',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=1',
      summary: 'OA | 人事管理类 | 李帅',
      sender: '李帅',
      category: '人事管理类',
      source: 'OA',
      ...overrides,
      flowId: overrides.flowId ?? '1',
    };
  }

  it('keeps all todos when no category filter is provided', () => {
    const todos = [
      todo(),
      todo({
        title: '绩效审批',
        summary: '绩效管理 | 季度考核 | 王五',
        category: '季度考核',
        source: '绩效管理',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=2',
      }),
    ];

    expect(filterIflytekOaTodosByCategory(todos)).toEqual(todos);
  });

  it('matches the site category name exactly', () => {
    const todos = [
      todo(),
      todo({
        title: '绩效审批',
        summary: '绩效管理 | 季度考核 | 王五',
        category: '季度考核',
        source: '绩效管理',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=2',
      }),
      todo({
        title: '预算审批',
        summary: 'OA-扩展 | 财务 | 赵六',
        category: '财务',
        source: 'OA-扩展',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=3',
      }),
    ];

    expect(filterIflytekOaTodosByCategory(todos, 'OA')).toEqual([todos[0]]);
    expect(filterIflytekOaTodosByCategory(todos, '绩效管理')).toEqual([todos[1]]);
  });

  it('ignores surrounding whitespace in the requested category only', () => {
    const todos = [
      todo(),
      todo({
        title: '绩效审批',
        summary: '绩效管理 | 季度考核 | 王五',
        category: '季度考核',
        source: '绩效管理',
        url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=2',
      }),
    ];

    expect(filterIflytekOaTodosByCategory(todos, '  绩效管理  ')).toEqual([todos[1]]);
  });
});
