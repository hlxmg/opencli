import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatListBookingsResult, listIflytekMeetingBookings } from './utils.js';

export const listBookingsCommand = cli({
  site: 'iflytek_meeting',
  name: 'list-bookings',
  description: 'List your future pending iFlytek meeting room bookings',
  domain: 'ipark.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  columns: ['Room', 'Date', 'Time', 'Title', 'OrderId'],
  func: async (page) => {
    const results = await listIflytekMeetingBookings(page);
    return formatListBookingsResult(results);
  },
});
