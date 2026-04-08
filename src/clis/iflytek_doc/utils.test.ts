import { describe, expect, it } from 'vitest';
import {
  buildIflytekDocBodyPastePayload,
  buildIflytekDocCreateRequest,
  getIflytekDocAppendScrollSettleSeconds,
  shouldIflytekDocBodySetDomSelection,
  extractIflytekDocRootFolderToken,
  extractIflytekDocListItems,
  extractIflytekDocContentBlocks,
  formatIflytekDocContent,
  formatIflytekDocListResult,
  formatIflytekDocReadResult,
  formatIflytekDocWriteResult,
  getIflytekDocBodyEditorSelector,
  getIflytekDocTitleFocusAttempts,
  getIflytekDocWritePhases,
  getIflytekDocTitleSettleSeconds,
  getIflytekDocCreateEntrySelectors,
  getIflytekDocCreateTypeLabels,
  isIflytekDocBodyCommitted,
  isIflytekDocTitleCommitted,
  isIflytekDocReady,
  normalizeIflytekDocTarget,
  parseIflytekDocCsrfToken,
} from './utils.js';

describe('normalizeIflytekDocTarget', () => {
  it('accepts a bare doc id', () => {
    expect(normalizeIflytekDocTarget('doxcn123456')).toEqual({
      docId: 'doxcn123456',
      url: 'https://yf2ljykclb.xfchat.iflytek.com/docx/doxcn123456',
    });
  });

  it('extracts the doc id from a full doc url', () => {
    expect(normalizeIflytekDocTarget('https://yf2ljykclb.xfchat.iflytek.com/docx/doxabcXYZ123?from=recent')).toEqual({
      docId: 'doxabcXYZ123',
      url: 'https://yf2ljykclb.xfchat.iflytek.com/docx/doxabcXYZ123',
    });
  });

  it('rejects unsupported targets', () => {
    expect(() => normalizeIflytekDocTarget('https://example.com/not-doc')).toThrow('Unsupported iFlytek doc target');
  });
});

describe('isIflytekDocReady', () => {
  it('recognizes an opened drive page with creation controls', () => {
    expect(isIflytekDocReady({
      href: 'https://yf2ljykclb.xfchat.iflytek.com/drive/me/',
      bodyText: '我的空间 模板库 添加 上传 新建',
    })).toBe(true);
  });

  it('recognizes an opened doc page', () => {
    expect(isIflytekDocReady({
      href: 'https://yf2ljykclb.xfchat.iflytek.com/docx/doxabc123',
      bodyText: '输入“/”快速插入内容 添加图标 添加封面',
    })).toBe(true);
  });

  it('returns false for login pages', () => {
    expect(isIflytekDocReady({
      href: 'https://accounts.xfchat.iflytek.com/accounts/page/login',
      bodyText: '扫码登录 i讯飞 登录',
    })).toBe(false);
  });
});

describe('formatIflytekDocWriteResult', () => {
  it('formats a write result for CLI output', () => {
    expect(formatIflytekDocWriteResult({
      status: 'saved',
      mode: 'new',
      docId: 'doxabc123',
      title: 'Agent 周报',
      url: 'https://yf2ljykclb.xfchat.iflytek.com/docx/doxabc123',
      space: 'me',
    })).toEqual([{
      Status: 'saved',
      Mode: 'new',
      Title: 'Agent 周报',
      DocId: 'doxabc123',
      Space: 'me',
      URL: 'https://yf2ljykclb.xfchat.iflytek.com/docx/doxabc123',
    }]);
  });
});

describe('create helpers', () => {
  it('extracts the csrf token from document.cookie', () => {
    expect(parseIflytekDocCsrfToken('foo=1; _csrf_token=abc123; bar=2')).toBe('abc123');
    expect(parseIflytekDocCsrfToken('foo=1; bar=2')).toBe('');
  });

  it('extracts the my-space root folder token from explorer data', () => {
    expect(extractIflytekDocRootFolderToken({
      data: {
        entities: {
          nodes: {
            root: { token: 'nod_root', type: 4, name: '我的空间' },
            file1: { token: 'nod_file', type: 22, name: '测试文档' },
          },
        },
      },
    })).toBe('nod_root');
  });

  it('builds the create request with form data and csrf header', () => {
    expect(buildIflytekDocCreateRequest('csrf_123', 'nod_root')).toEqual({
      url: '/space/api/explorer/create/',
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-CSRFToken': 'csrf_123',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: 'type=22&folder_token=nod_root',
    });
  });

  it('recognizes when the title is committed and the editor can continue', () => {
    expect(isIflytekDocTitleCommitted({
      docTitleText: '正式标题',
      titleInputVisible: false,
    }, '正式标题')).toBe(true);
  });

  it('keeps waiting while the title editor is still open or stale', () => {
    expect(isIflytekDocTitleCommitted({
      docTitleText: '正式标题',
      titleInputVisible: true,
    }, '正式标题')).toBe(false);

    expect(isIflytekDocTitleCommitted({
      docTitleText: '未命名文档',
      titleInputVisible: false,
    }, '正式标题')).toBe(false);
  });

  it('writes title before body so the explicit title remains authoritative', () => {
    expect(getIflytekDocWritePhases('new')).toEqual(['title', 'body']);
  });

  it('uses the same phase order for existing docs', () => {
    expect(getIflytekDocWritePhases('reuse')).toEqual(['title', 'body']);
  });

  it('waits a settle window after title commit before typing body', () => {
    expect(getIflytekDocTitleSettleSeconds()).toBe(4);
  });

  it('targets the actual text editor instead of the root wrapper when writing body', () => {
    expect(getIflytekDocBodyEditorSelector()).toBe('.zone-container.text-editor');
  });

  it('allows a longer retry window before giving up on title focus', () => {
    expect(getIflytekDocTitleFocusAttempts()).toBe(20);
  });

  it('writes new body content as a new paragraph after the title paragraph', () => {
    expect(buildIflytekDocBodyPastePayload('正文内容')).toBe('\n正文内容');
  });

  it('waits for the long document viewport to settle before appending', () => {
    expect(getIflytekDocAppendScrollSettleSeconds()).toBe(1.5);
  });

  it('skips DOM range selection when append uses the dedicated append path', () => {
    expect(shouldIflytekDocBodySetDomSelection({ appendToEnd: true })).toBe(false);
    expect(shouldIflytekDocBodySetDomSelection({ appendToEnd: false })).toBe(true);
  });

  it('recognizes a committed body only when the editor still contains title and body', () => {
    expect(isIflytekDocBodyCommitted({
      editorText: '正式标题\n正文内容',
    }, '正式标题', '正文内容')).toBe(true);

    expect(isIflytekDocBodyCommitted({
      editorText: '正式标题',
    }, '正式标题', '正文内容')).toBe(false);
  });

  it('extracts content blocks from page-block payloads', () => {
    expect(extractIflytekDocContentBlocks([
      { index: 0, text: '第一段' },
      { index: 1, text: '第二段' },
      { index: 2, text: '   ' },
    ])).toEqual(['第一段', '第二段']);
  });

  it('formats content blocks into plain text', () => {
    expect(formatIflytekDocContent(['第一段', '第二段'])).toBe('第一段\n\n第二段');
  });
});

describe('doc creation strategy', () => {
  it('only targets the 新建 entry, not 添加', () => {
    expect(getIflytekDocCreateEntrySelectors()).toEqual([
      'button[data-selector="explorer-v3-create_new_file"]',
    ]);
  });

  it('only accepts document creation labels after opening 新建', () => {
    expect(getIflytekDocCreateTypeLabels()).toEqual([
      '文档',
      '在线文档',
      '新建文档',
    ]);
  });
});

describe('doc read and list formatting', () => {
  it('extracts document items from explorer payload', () => {
    expect(extractIflytekDocListItems({
      data: {
        entities: {
          nodes: {
            root: { token: 'folder_1', type: 4, name: '我的空间' },
            doc1: { obj_token: 'dox1', type: 22, title: '日报', edit_time: '2026-04-02 14:00' },
            doc2: { token: 'dox2', type: 22, name: '周报', update_time: '2026-04-01 09:00' },
          },
        },
      },
    })).toEqual([
      {
        docId: 'dox1',
        title: '日报',
        updatedAt: '2026-04-02 14:00',
        url: 'https://yf2ljykclb.xfchat.iflytek.com/docx/dox1',
      },
      {
        docId: 'dox2',
        title: '周报',
        updatedAt: '2026-04-01 09:00',
        url: 'https://yf2ljykclb.xfchat.iflytek.com/docx/dox2',
      },
    ]);
  });

  it('formats list rows for CLI output', () => {
    expect(formatIflytekDocListResult([{
      docId: 'dox1',
      title: '日报',
      updatedAt: '2026-04-02 14:00',
      url: 'https://yf2ljykclb.xfchat.iflytek.com/docx/dox1',
    }])).toEqual([{
      Index: '1',
      Title: '日报',
      UpdatedAt: '2026-04-02 14:00',
      DocId: 'dox1',
      URL: 'https://yf2ljykclb.xfchat.iflytek.com/docx/dox1',
    }]);
  });

  it('formats read output for CLI output', () => {
    expect(formatIflytekDocReadResult({
      docId: 'dox1',
      title: '日报',
      content: '第一段\n\n第二段',
      url: 'https://yf2ljykclb.xfchat.iflytek.com/docx/dox1',
    })).toEqual([{
      Title: '日报',
      Content: '第一段\n\n第二段',
      DocId: 'dox1',
      URL: 'https://yf2ljykclb.xfchat.iflytek.com/docx/dox1',
    }]);
  });
});
