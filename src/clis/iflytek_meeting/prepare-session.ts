import { cli, Strategy } from '@jackwener/opencli/registry';
import { IFLYTEK_MEETING_ORDER_URL } from './utils.js';

export const prepareSessionCommand = cli({
  site: 'iflytek_meeting',
  name: 'prepare-session',
  description: 'Open the iFlytek meeting room page in the shared automation workspace so you can log in there',
  domain: 'ipark.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  columns: ['Status', 'URL', 'Title', 'Next'],
  func: async (page) => {
    try {
      await page.goto(IFLYTEK_MEETING_ORDER_URL);
    } catch {
      // The page still often lands successfully despite target-change errors.
    }
    await page.wait(2);

    const result = await page.evaluate(`
      (() => ({
        href: location.href,
        title: document.title || '',
        text: (document.body?.innerText || '').slice(0, 200)
      }))()
    `) as { href?: string; title?: string; text?: string };

    const loggedIn = !!result.text && /会议室|常用会议室|推荐会议室/.test(result.text);
    const status = loggedIn ? 'ready' : 'login-required';
    const next = loggedIn
      ? 'Run opencli iflytek_meeting book-room in the next 2 minutes'
      : 'Finish login in this opened window, then run opencli iflytek_meeting book-room within 2 minutes';

    return [{
      Status: status,
      URL: result.href || IFLYTEK_MEETING_ORDER_URL,
      Title: result.title || '-',
      Next: next,
    }];
  },
});
