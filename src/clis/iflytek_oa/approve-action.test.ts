import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApproveIflytekOaTodo } = vi.hoisted(() => ({
  mockApproveIflytekOaTodo: vi.fn(),
}));

vi.mock('./utils.js', async () => {
  const actual = await vi.importActual<typeof import('./utils.js')>('./utils.js');
  return {
    ...actual,
    approveIflytekOaTodo: mockApproveIflytekOaTodo,
  };
});

import { getRegistry } from '../../registry.js';
import './approve-action.js';

describe('iflytek_oa approve-action command', () => {
  const command = getRegistry().get('iflytek_oa/approve-action');

  beforeEach(() => {
    mockApproveIflytekOaTodo.mockReset();
  });

  it('requires either --id or --url', async () => {
    await expect(command!.func!({} as any, { action: 'approve' })).rejects.toMatchObject({
      code: 'ARGUMENT',
      message: 'Either --id or --url is required',
    });
  });

  it('requires --action', async () => {
    await expect(command!.func!({} as any, { id: '12345' })).rejects.toMatchObject({
      code: 'ARGUMENT',
      message: '--action must be approve or reject',
    });
  });

  it('formats approval rows from the shared utils helper', async () => {
    mockApproveIflytekOaTodo.mockResolvedValue({
      title: '请假申请',
      action: 'approve',
      flowId: '12345',
      status: 'approved',
      message: '审批成功',
      url: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
    });

    const rows = await command!.func!({} as any, { id: '12345', action: 'approve' });

    expect(rows).toEqual([{
      Title: '请假申请',
      Action: 'approve',
      FlowId: '12345',
      Status: 'approved',
      Message: '审批成功',
      URL: 'https://oa.iflytek.com/workflow/request/ViewRequest.jsp?requestid=12345',
    }]);
  });
});
