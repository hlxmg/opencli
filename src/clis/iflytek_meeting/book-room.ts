import { cli, Strategy } from '@jackwener/opencli/registry';
import { bookIflytekMeetingRoom, formatBookRoomResult } from './utils.js';

export const bookRoomCommand = cli({
  site: 'iflytek_meeting',
  name: 'book-room',
  description: 'Book a free meeting room from the iFlytek portal in conservative mode',
  domain: 'ipark.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  args: [
    { name: 'date', required: true, help: 'Booking date in YYYY-MM-DD format' },
    { name: 'start', required: true, help: 'Start time in HH:mm format' },
    { name: 'end', required: true, help: 'End time in HH:mm format' },
    { name: 'title', required: false, help: 'Meeting title (defaults to "<empName>的会议")' },
    { name: 'room-keyword', required: false, help: 'Prefer rooms whose name includes this keyword' },
    { name: 'min-capacity', required: false, help: 'Minimum room capacity' },
    { name: 'dry-run', required: false, type: 'bool', help: 'Pick a free room without submitting', default: false },
  ],
  columns: ['Status', 'Room', 'Date', 'Time', 'Title', 'OrderId'],
  func: async (page, kwargs) => {
    const result = await bookIflytekMeetingRoom(page, {
      date: String(kwargs.date),
      startTime: String(kwargs.start),
      endTime: String(kwargs.end),
      title: kwargs.title ? String(kwargs.title) : undefined,
      roomKeyword: kwargs['room-keyword'] ? String(kwargs['room-keyword']) : undefined,
      minCapacity: kwargs['min-capacity'] ? Number(kwargs['min-capacity']) : undefined,
      dryRun: kwargs['dry-run'] === true,
    });
    return formatBookRoomResult(result);
  },
});
