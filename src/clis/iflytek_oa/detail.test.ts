import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetIflytekOaTodoDetail } = vi.hoisted(() => ({
  mockGetIflytekOaTodoDetail: vi.fn(),
}));

vi.mock('./utils.js', async () => {
  const actual = await vi.importActual<typeof import('./utils.js')>('./utils.js');
  return {
    ...actual,
    getIflytekOaTodoDetail: mockGetIflytekOaTodoDetail,
  };
});

import { getRegistry } from '../../registry.js';
import './detail.js';

describe('iflytek_oa detail command', () => {
  const detail = getRegistry().get('iflytek_oa/detail');

  beforeEach(() => {
    mockGetIflytekOaTodoDetail.mockReset();
  });

  it('requires either --id or --url', async () => {
    await expect(detail!.func!({} as any, { status: 'pending' })).rejects.toMatchObject({
      code: 'ARGUMENT',
      message: 'Either --id or --url is required',
    });
  });

  it('formats detail rows from the shared utils helper', async () => {
    mockGetIflytekOaTodoDetail.mockResolvedValue({
      title: '请假申请',
      status: '待办',
      flowId: '12345',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
      sender: '李帅',
      updatedAt: '今天14:02',
      detailText: '申请人 李帅 事由 年假',
    });

    const rows = await detail!.func!({} as any, { id: '12345', status: 'pending' });

    expect(rows).toEqual([{
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
