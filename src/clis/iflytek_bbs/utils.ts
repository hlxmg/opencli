import { sendCommand } from '@jackwener/opencli/browser';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_BBS_HOME_URL = 'https://in.iflytek.com/fornt/forum/index';
export const IFLYTEK_BBS_APP_URL = 'https://in.iflytek.com/iflyteksns/forum/web/index';
export const IFLYTEK_BBS_DOMAIN = 'in.iflytek.com';
export const IFLYTEK_BBS_WORKSPACE = 'site:iflytek_bbs';

interface TabInfo {
  tabId?: number;
}

export interface IflytekBbsBoardRow {
  Board: string;
  Description: string;
  URL: string;
}

export interface IflytekBbsTopicRow {
  Title: string;
  Author: string;
  Replies: string;
  Views: string;
  UpdatedAt: string;
  URL: string;
}

export interface IflytekBbsSearchRow {
  Title: string;
  Author: string;
  Board: string;
  UpdatedAt: string;
  URL: string;
}

export interface IflytekBbsTopicDetail {
  Title: string;
  Author: string;
  PublishedAt: string;
  Board: string;
  Content: string;
  URL: string;
}

interface IflytekBbsPageState {
  href?: string;
  bodyText?: string;
}

const LOGIN_KEYWORDS = ['统一认证平台', '扫码登录', '账号登录', '验证码登录'];
const HOMEPAGE_PANEL_BOARD_NAMES = ['飞er心声', '飞er爱问', '飞er聚嗨'];
const KNOWN_BOARD_DESCRIPTIONS = new Map([
  ['飞er心声', '你简单说，我真诚听'],
  ['飞er爱问', '想你所想，答你所问'],
  ['飞er聚嗨', '五湖四海，快乐相聚'],
  ['钻石专题', '-'],
]);

function collapseWhitespace(value: string | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string | undefined): string {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripHtml(value: string | undefined): string {
  return collapseWhitespace(decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveUrl(href: string | undefined, origin: string): string {
  const value = collapseWhitespace(href);
  if (!value) return '';
  try {
    return new URL(value, origin).toString();
  } catch {
    return value;
  }
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return NaN;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function uniqueByUrl<T extends { URL: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const results: T[] = [];
  for (const row of rows) {
    if (!row.URL || seen.has(row.URL)) continue;
    seen.add(row.URL);
    results.push(row);
  }
  return results;
}

function extractDigits(value: string | undefined): string[] {
  return Array.from(String(value ?? '').matchAll(/\d+/g)).map((match) => match[0]);
}

function extractCounterValues(html: string | undefined): string[] {
  return Array.from(String(html ?? '').matchAll(/<em[^>]*>([\s\S]*?)<\/em>/g))
    .map((match) => extractDigits(stripHtml(match[1]))[0] ?? '')
    .filter(Boolean);
}

function pickLikelyAuthor(value: string | undefined): string {
  const cleaned = collapseWhitespace(value).replace(/\s+\d+\s*$/, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(' ').filter(Boolean);
  return parts.at(-1) ?? cleaned;
}

export function extractIflytekBbsBoardsFromHtml(html: string, origin: string): IflytekBbsBoardRow[] {
  const genericRows = Array.from(html.matchAll(/<div class="forum-board">([\s\S]*?)<\/div>/g))
    .map((match) => {
      const block = match[1];
      const href = block.match(/href="([^"]+)"/)?.[1] ?? '';
      const board = stripHtml(block.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);
      const description = stripHtml(block.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]);
      return {
        Board: board,
        Description: description || '-',
        URL: resolveUrl(href, origin),
      };
    })
    .filter((row) => row.Board && row.URL);
  if (genericRows.length > 0) return uniqueByUrl(genericRows);

  const menuRows = Array.from(html.matchAll(
    /<a[^>]*class="[^"]*index-menu__item[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
  ))
    .map((match) => {
      const url = resolveUrl(match[1], origin);
      const board = stripHtml(match[2]);
      return {
        Board: board,
        Description: KNOWN_BOARD_DESCRIPTIONS.get(board) ?? '-',
        URL: url,
      };
    })
    .filter((row) => row.Board && row.URL && !row.URL.includes('/mall/'));

  return uniqueByUrl(menuRows);
}

export function extractIflytekBbsTopicsFromHtml(html: string, origin: string): IflytekBbsTopicRow[] {
  const genericRows = Array.from(html.matchAll(/<div class="topic-row">([\s\S]*?)<\/div>/g))
    .map((match) => {
      const block = match[1];
      const href = block.match(/class="topic-title"[^>]*href="([^"]+)"/)?.[1] ?? '';
      const title = stripHtml(block.match(/class="topic-title"[^>]*>([\s\S]*?)<\/a>/)?.[1]);
      const author = stripHtml(block.match(/class="author"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      const replies = stripHtml(block.match(/class="replies"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      const views = stripHtml(block.match(/class="views"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      const updatedAt = stripHtml(block.match(/class="updated"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      return {
        Title: title,
        Author: author || '-',
        Replies: replies || '-',
        Views: views || '-',
        UpdatedAt: updatedAt || '-',
        URL: resolveUrl(href, origin),
      };
    })
    .filter((row) => row.Title && row.URL);
  if (genericRows.length > 0) return uniqueByUrl(genericRows);

  const pageRows = Array.from(html.matchAll(
    /<li>\s*<div class="title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<div class="conte clearfix">([\s\S]*?)<\/div>\s*<\/li>/g,
  ))
    .map((match) => {
      const url = resolveUrl(match[1], origin);
      const title = stripHtml(match[2]);
      const meta = match[3];
      const author = stripHtml(meta.match(/<span class="normal">\s*([\s\S]*?)<\/span>/)?.[1]);
      const publishedAt = stripHtml(meta.match(/发表时间：\s*([\s\S]*?)<\/span>/)?.[1]);
      const lastReply = stripHtml(meta.match(/最后回复：\s*([\s\S]*?)<\/span>/)?.[1]);
      const counts = extractCounterValues(meta.match(/<span class="operate[\s\S]*?<\/span>/)?.[0]);
      return {
        Title: title,
        Author: author || '-',
        Replies: counts[1] ?? '-',
        Views: counts[0] ?? '-',
        UpdatedAt: lastReply || publishedAt || '-',
        URL: url,
      };
    })
    .filter((row) => row.Title && row.URL);

  return uniqueByUrl(pageRows);
}

export function extractIflytekBbsTopicDetailFromHtml(html: string, url: string): IflytekBbsTopicDetail {
  const genericTitle = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
  const genericAuthor = stripHtml(html.match(/class="author"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
  const genericBoard = stripHtml(html.match(/class="board"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
  const genericPublishedAt = stripHtml(html.match(/class="published"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
  const genericContent = stripHtml(html.match(/class="topic-content"[^>]*>([\s\S]*?)<\/div>/)?.[1]);

  if (genericTitle || genericContent) {
    return {
      Title: genericTitle || '-',
      Author: genericAuthor || '-',
      PublishedAt: genericPublishedAt || '-',
      Board: genericBoard || '-',
      Content: genericContent || '-',
      URL: url,
    };
  }

  const title = stripHtml(html.match(/<div class="title">\s*([\s\S]*?)<h4/s)?.[1])
    || stripHtml(html.match(/<a class="bread"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/)?.[1]);
  const board = stripHtml(html.match(/<a class="bread first"[^>]*>([\s\S]*?)<\/a>/)?.[1]);
  const publishedAt = stripHtml(html.match(/发布时间：\s*([\s\S]*?)(?:<\/span>|<span class="operate)/)?.[1]);
  const mainBlock = html.match(/<div class="plate-content">([\s\S]*?)<div class="praise-collection clearfix"/)?.[1] ?? '';
  const paragraphs = Array.from(mainBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  const content = paragraphs.join('\n\n');
  const bodyText = stripHtml(html);
  const authorSegments = title ? bodyText.split(title) : [];
  const authorSegment = authorSegments[1] ?? authorSegments.at(-1) ?? '';
  const authorMatch = authorSegment.match(/^([\s\S]{1,80}?)\s+\d+\s*帖子数/);
  const authorFallback = collapseWhitespace(authorSegment.split('帖子数')[0]).replace(/\s+\d+\s*$/, '').trim();
  const authorPanelText = Array.from(html.matchAll(/<div[^>]*>([\s\S]{0,800}?帖子数[\s\S]{0,200}?积分[\s\S]{0,200}?)<\/div>/g))
    .map((match) => stripHtml(match[1]))
    .find((text) => text.includes('帖子数') && text.includes('积分'));
  const authorFromPanel = pickLikelyAuthor((authorPanelText ?? '')
    .replace(board, '')
    .replace(title, '')
    .split('帖子数')[0]);
  const author = collapseWhitespace(authorMatch?.[1] || authorFallback || authorFromPanel);

  return {
    Title: title || '-',
    Author: author || '-',
    PublishedAt: publishedAt || '-',
    Board: board || '-',
    Content: content || '-',
    URL: url,
  };
}

function extractIflytekBbsSearchRowsFromHtml(html: string, origin: string): IflytekBbsSearchRow[] {
  return uniqueByUrl(Array.from(html.matchAll(
    /<li>\s*<div class="title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/div>[\s\S]*?<div class="conte clearfix">([\s\S]*?)<\/div>\s*<\/li>/g,
  ))
    .map((match) => {
      const url = resolveUrl(match[1], origin);
      const title = stripHtml(match[2]);
      const meta = match[3];
      const author = stripHtml(
        meta.match(/<span class="noraml">\s*([\s\S]*?)<\/span>/)?.[1]
        ?? meta.match(/<span class="normal">\s*([\s\S]*?)<\/span>/)?.[1],
      );
      const publishedAt = stripHtml(meta.match(/发布时间：\s*([\s\S]*?)<\/span>/)?.[1]);
      const lastReply = stripHtml(meta.match(/最后回复：\s*([\s\S]*?)<\/span>/)?.[1]);
      return {
        Title: title,
        Author: author || '-',
        Board: '-',
        UpdatedAt: lastReply || publishedAt || '-',
        URL: url,
      };
    })
    .filter((row) => row.Title && row.URL));
}

async function adoptExistingIflytekBbsTab(): Promise<void> {
  const activeMatches = await sendCommand('tabs', {
    op: 'find',
    workspace: IFLYTEK_BBS_WORKSPACE,
    domain: IFLYTEK_BBS_DOMAIN,
    active: true,
  }) as TabInfo[] | null;

  const anyMatches = activeMatches && activeMatches.length > 0
    ? activeMatches
    : await sendCommand('tabs', {
        op: 'find',
        workspace: IFLYTEK_BBS_WORKSPACE,
        domain: IFLYTEK_BBS_DOMAIN,
      }) as TabInfo[] | null;

  const tabId = anyMatches?.find((tab) => typeof tab.tabId === 'number')?.tabId;
  if (typeof tabId === 'number') {
    await sendCommand('tabs', {
      op: 'adopt',
      workspace: IFLYTEK_BBS_WORKSPACE,
      tabId,
    });
  }
}

async function getIflytekBbsPageState(page: IPage): Promise<IflytekBbsPageState> {
  return page.evaluate(`
    (() => ({
      href: location.href,
      bodyText: (document.body?.innerText || '').slice(0, 2500),
    }))()
  `) as Promise<IflytekBbsPageState>;
}

function isIflytekBbsLoginPage(state: IflytekBbsPageState): boolean {
  const href = state.href ?? '';
  const bodyText = state.bodyText ?? '';
  return href.includes('/sso/login') || LOGIN_KEYWORDS.some((keyword) => bodyText.includes(keyword));
}

async function openIflytekBbsApp(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_BBS_APP_URL);
  } catch {
    try {
      await page.goto(IFLYTEK_BBS_HOME_URL);
    } catch {
      // Shared browser sessions can briefly lose the inspected target during navigation.
    }
  }
  await page.wait(2);
}

export async function ensureIflytekBbsReady(page: IPage): Promise<void> {
  await adoptExistingIflytekBbsTab().catch(() => {});

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await getIflytekBbsPageState(page);
    if (isIflytekBbsLoginPage(state)) {
      throw new AuthRequiredError(
        IFLYTEK_BBS_DOMAIN,
        'Please open Chrome and log in to the iFlytek BBS before running iflytek_bbs commands.',
      );
    }
    if ((state.href ?? '').includes('/iflyteksns/forum/web/')) return;
    await openIflytekBbsApp(page);
  }

  throw new CommandExecutionError('Failed to open the iFlytek BBS page.');
}

async function goToUrl(page: IPage, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch {
    // Shared browser sessions can briefly lose the inspected target during navigation.
  }
  await page.wait(2);
}

async function extractVisibleBoardsFromHomepage(page: IPage): Promise<IflytekBbsBoardRow[]> {
  return page.evaluate(`
    (() => {
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const rows = [];
      const descriptions = new Map();
      const panelNames = ['飞er心声', '飞er爱问', '飞er聚嗨'];
      for (const block of Array.from(document.querySelectorAll('.index-panel__item'))) {
        const text = clean(block.textContent || '');
        const board = panelNames.find((name) => text.includes(name));
        if (!board) continue;
        const match = text.match(new RegExp(board + '\\\\s+(.+?)\\\\s+查看更多'));
        descriptions.set(board, clean(match?.[1]) || '-');
      }
      for (const link of Array.from(document.querySelectorAll('a.index-menu__item'))) {
        const board = clean(link.textContent || '');
        const href = link.href || '';
        if (!board || !href || href.includes('/mall/')) continue;
        rows.push({
          Board: board,
          Description: descriptions.get(board) || (board === '钻石专题' ? '-' : '-'),
          URL: href,
        });
      }
      const seen = new Set();
      return rows.filter((row) => {
        if (!row.URL || seen.has(row.URL)) return false;
        seen.add(row.URL);
        return true;
      });
    })()
  `) as Promise<IflytekBbsBoardRow[]>;
}

async function extractHomepagePanelTopics(page: IPage, board: string): Promise<IflytekBbsTopicRow[]> {
  return page.evaluate(`
    (() => {
      const boardName = ${JSON.stringify(board)};
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const rows = [];
      for (const block of Array.from(document.querySelectorAll('.index-panel__item'))) {
        const text = clean(block.textContent || '');
        if (!text.includes(boardName)) continue;
        for (const link of Array.from(block.querySelectorAll('a'))) {
          if (!link.href || !link.href.includes('/snsDoc/detail/')) continue;
          const raw = clean(link.textContent || '');
          if (!raw) continue;
          const match = raw.match(/^(.*?)(20\\d{2}-\\d{2}-\\d{2})$/);
          rows.push({
            Title: clean(match?.[1] || raw),
            Author: '-',
            Replies: '-',
            Views: '-',
            UpdatedAt: clean(match?.[2]) || '-',
            URL: link.href,
          });
        }
      }
      const seen = new Set();
      return rows.filter((row) => {
        if (!row.URL || seen.has(row.URL)) return false;
        seen.add(row.URL);
        return true;
      });
    })()
  `) as Promise<IflytekBbsTopicRow[]>;
}

async function extractCurrentCracklingTopics(page: IPage): Promise<IflytekBbsTopicRow[]> {
  return page.evaluate(`
    (() => {
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const rows = [];
      for (const item of Array.from(document.querySelectorAll('.crackling-panel .crackling-ul > li'))) {
        const link = item.querySelector('.title a');
        if (!link || !link.href || !link.href.includes('/snsDoc/detail/')) continue;
        const title = clean(link.textContent || '');
        if (!title) continue;
        const author = clean(item.querySelector('.conte .normal')?.textContent || '') || '-';
        const timeTexts = Array.from(item.querySelectorAll('.conte .normal.prev-line')).map((node) => clean(node.textContent || ''));
        const publishedAt = clean(timeTexts.find((text) => text.includes('发表时间'))?.replace(/^发表时间：?\\s*/, ''));
        const lastReply = clean(timeTexts.find((text) => text.includes('最后回复'))?.replace(/^最后回复：?\\s*/, ''));
        const counts = Array.from(item.querySelectorAll('.operate em'))
          .map((node) => clean(node.textContent || '').replace(/[^\\d]/g, ''))
          .filter(Boolean);
        rows.push({
          Title: title,
          Author: author,
          Replies: counts[1] || '-',
          Views: counts[0] || '-',
          UpdatedAt: lastReply || publishedAt || '-',
          URL: link.href,
        });
      }
      return rows;
    })()
  `) as Promise<IflytekBbsTopicRow[]>;
}

async function extractCurrentSpecialTopics(page: IPage): Promise<IflytekBbsTopicRow[]> {
  return page.evaluate(`
    (() => {
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      return Array.from(document.querySelectorAll('.special-inner > li a'))
        .map((link) => ({
          Title: clean(link.querySelector('h5')?.textContent || ''),
          Author: '-',
          Replies: '-',
          Views: '-',
          UpdatedAt: '-',
          URL: link.href || '',
        }))
        .filter((row) => row.Title && row.URL);
    })()
  `) as Promise<IflytekBbsTopicRow[]>;
}

async function extractCurrentTopicDetail(page: IPage): Promise<IflytekBbsTopicDetail> {
  return page.evaluate(`
    (() => {
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const escapeRegExp = (value) => value.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&');
      const main = document.querySelector('.table-content .plate-content');
      const titleNode = main?.querySelector('.title');
      const title = clean(
        Array.from(titleNode?.childNodes || [])
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent || '')
          .join(' ')
      ) || clean(document.querySelector('.breadcrumb .bread:last-child')?.textContent || '') || '-';
      const board = clean(document.querySelector('.breadcrumb .bread.first')?.textContent || '') || '-';
      const metaText = clean(main?.querySelector('.conte')?.textContent || '');
      const publishedAt = clean(metaText.match(/发布时间：\\s*(.+?)(?:\\s+分享|\\s+\\d+$|$)/)?.[1]) || '-';
      const paragraphs = Array.from(main?.querySelectorAll('p') || [])
        .map((node) => clean(node.textContent || ''))
        .filter(Boolean);
      const content = paragraphs.join('\\n\\n') || '-';
      const bodyText = clean(document.body?.innerText || '');
      const authorParts = title && title !== '-' ? bodyText.split(title) : [];
      const authorSegment = authorParts[1] || authorParts[authorParts.length - 1] || '';
      const authorMatch = authorSegment.match(/^([\\s\\S]{1,80}?)\\s+\\d+\\s*帖子数/);
      const authorFallback = clean(authorSegment.split('帖子数')[0]).replace(/\\s+\\d+\\s*$/, '').trim();
      const authorPanelText = clean(
        Array.from(document.querySelectorAll('div, li, span'))
          .map((node) => clean(node.textContent || ''))
          .find((text) => text.includes('帖子数') && text.includes('积分')) || ''
      );
      const authorFromPanel = clean(authorPanelText.replace(board, '').replace(title, '').split('帖子数')[0])
        .replace(/\\s+\\d+\\s*$/, '')
        .trim()
        .split(' ')
        .filter(Boolean)
        .slice(-1)[0] || '';
      return {
        Title: title,
        Author: clean(authorMatch?.[1] || authorFallback || authorFromPanel) || '-',
        PublishedAt: publishedAt,
        Board: board,
        Content: content,
        URL: location.href,
      };
    })()
  `) as Promise<IflytekBbsTopicDetail>;
}

async function enrichSearchRowsWithBoards(page: IPage, rows: IflytekBbsSearchRow[]): Promise<IflytekBbsSearchRow[]> {
  if (rows.length === 0) return rows;
  const boards = await page.evaluate(`
    (async () => {
      const urls = ${JSON.stringify(rows.map((row) => row.URL))};
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const results = await Promise.all(urls.map(async (url) => {
        try {
          const response = await fetch(url, { credentials: 'include' });
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const board = clean(doc.querySelector('.breadcrumb .bread.first')?.textContent || '');
          return { url, board };
        } catch {
          return { url, board: '' };
        }
      }));
      return results;
    })()
  `) as Array<{ url: string; board?: string }>;

  const boardMap = new Map(boards.map((item) => [item.url, collapseWhitespace(item.board)]));
  return rows.map((row) => ({
    ...row,
    Board: boardMap.get(row.URL) || '-',
  }));
}

export async function listIflytekBbsBoards(page: IPage): Promise<IflytekBbsBoardRow[]> {
  await ensureIflytekBbsReady(page);
  await goToUrl(page, IFLYTEK_BBS_APP_URL);
  const rows = await extractVisibleBoardsFromHomepage(page);
  if (rows.length > 0) return rows;

  const html = await page.evaluate('document.documentElement.outerHTML') as string;
  return extractIflytekBbsBoardsFromHtml(html, IFLYTEK_BBS_APP_URL);
}

export async function listIflytekBbsTopics(page: IPage, board: string, limit: number): Promise<IflytekBbsTopicRow[]> {
  const cappedLimit = normalizeLimit(limit);
  if (!Number.isFinite(cappedLimit)) {
    throw new CommandExecutionError(`Invalid iflytek_bbs topic-list limit: ${limit}`);
  }

  await ensureIflytekBbsReady(page);
  const boards = await listIflytekBbsBoards(page);
  const matchedBoard = boards.find((item) => item.Board === collapseWhitespace(board));
  if (!matchedBoard) {
    throw new CommandExecutionError(`Board "${board}" was not found on the iFlytek BBS homepage.`);
  }

  await goToUrl(page, matchedBoard.URL);
  const state = await getIflytekBbsPageState(page);
  let rows: IflytekBbsTopicRow[] = [];

  if ((state.href ?? '').includes('/special_list/')) {
    rows = await extractCurrentSpecialTopics(page);
  } else if ((state.href ?? '').includes('/special/') && (state.bodyText ?? '').includes('排序：')) {
    rows = await extractCurrentCracklingTopics(page);
  } else if (HOMEPAGE_PANEL_BOARD_NAMES.includes(matchedBoard.Board)) {
    await goToUrl(page, IFLYTEK_BBS_APP_URL);
    rows = await extractHomepagePanelTopics(page, matchedBoard.Board);
  }

  if (rows.length === 0) {
    const html = await page.evaluate('document.documentElement.outerHTML') as string;
    rows = extractIflytekBbsTopicsFromHtml(html, state.href || matchedBoard.URL);
  }

  if (rows.length === 0) {
    throw new CommandExecutionError(`No visible topics were found for board "${board}".`);
  }

  return uniqueByUrl(rows).slice(0, cappedLimit);
}

export async function readIflytekBbsTopic(page: IPage, id: string): Promise<IflytekBbsTopicDetail> {
  const topicId = collapseWhitespace(id);
  if (!/^\d+$/.test(topicId)) {
    throw new CommandExecutionError(`Topic id "${id}" is invalid. Expected a numeric topic id.`);
  }

  await ensureIflytekBbsReady(page);
  const url = `https://${IFLYTEK_BBS_DOMAIN}/iflyteksns/forum/web/snsDoc/detail/${topicId}`;
  await goToUrl(page, url);
  const state = await getIflytekBbsPageState(page);
  if (isIflytekBbsLoginPage(state)) {
    throw new AuthRequiredError(
      IFLYTEK_BBS_DOMAIN,
      'Please open Chrome and log in to the iFlytek BBS before reading topics.',
    );
  }

  const detail = await extractCurrentTopicDetail(page);
  if (detail.Title !== '-' || detail.Content !== '-') return detail;

  const html = await page.evaluate('document.documentElement.outerHTML') as string;
  return extractIflytekBbsTopicDetailFromHtml(html, url);
}

export async function searchIflytekBbsTopics(page: IPage, keyword: string, limit: number): Promise<IflytekBbsSearchRow[]> {
  const cappedLimit = normalizeLimit(limit);
  if (!Number.isFinite(cappedLimit)) {
    throw new CommandExecutionError(`Invalid iflytek_bbs search limit: ${limit}`);
  }

  const query = collapseWhitespace(keyword);
  if (!query) {
    throw new CommandExecutionError('Search keyword must not be empty.');
  }

  await ensureIflytekBbsReady(page);
  const url = `https://${IFLYTEK_BBS_DOMAIN}/iflyteksns/forum/web/search?queryContent=${encodeURIComponent(query)}`;
  await goToUrl(page, url);

  let rows = await page.evaluate(`
    (() => {
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const results = [];
      for (const item of Array.from(document.querySelectorAll('.container-panel .crackling-ul > li'))) {
        if ((item.className || '').includes('search-text')) continue;
        const link = item.querySelector('.title a');
        if (!link || !link.href || !link.href.includes('/snsDoc/detail/')) continue;
        const title = clean(link.textContent || '');
        if (!title) continue;
        const meta = item.querySelector('.conte');
        const author = clean(meta?.querySelector('.noraml, .normal')?.textContent || '') || '-';
        const timeTexts = Array.from(meta?.querySelectorAll('.normal.prev-line') || []).map((node) => clean(node.textContent || ''));
        const publishedAt = clean(timeTexts.find((text) => text.includes('发布时间'))?.replace(/^发布时间：?\\s*/, ''));
        const lastReply = clean(timeTexts.find((text) => text.includes('最后回复'))?.replace(/^最后回复：?\\s*/, ''));
        results.push({
          Title: title,
          Author: author,
          Board: '-',
          UpdatedAt: lastReply || publishedAt || '-',
          URL: link.href,
        });
      }
      return results;
    })()
  `) as IflytekBbsSearchRow[];

  if (rows.length === 0) {
    const html = await page.evaluate('document.documentElement.outerHTML') as string;
    rows = extractIflytekBbsSearchRowsFromHtml(html, url);
  }

  rows = uniqueByUrl(rows).slice(0, cappedLimit);
  if (rows.length === 0) {
    throw new CommandExecutionError(`No iFlytek BBS search results were found for keyword "${query}".`);
  }

  return enrichSearchRowsWithBoards(page, rows);
}
