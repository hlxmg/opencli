import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatFreeSlotsResult, listIflytekMeetingRoomFreeSlots } from './utils.js';

export const freeSlotsCommand = cli({
  site: 'iflytek_meeting',
  name: 'free-slots',
  description: 'List free time windows for meeting rooms matching a fuzzy keyword on a given day',
  domain: 'ipark.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  args: [
    { name: 'date', required: true, help: 'Booking date in YYYY-MM-DD format' },
    { name: 'room-keyword', required: true, help: 'Fuzzy meeting room keyword such as 355 or A1北区 3楼' },
  ],
  columns: ['Room', 'Date', 'FreeSlot', 'OfficeId', 'RoomId'],
  func: async (page, kwargs) => {
    const results = await listIflytekMeetingRoomFreeSlots(page, {
      date: String(kwargs.date),
      roomKeyword: String(kwargs['room-keyword']),
    });
    return formatFreeSlotsResult(results);
  },
});
