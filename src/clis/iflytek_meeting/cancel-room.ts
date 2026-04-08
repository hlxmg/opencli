import { cli, Strategy } from '@jackwener/opencli/registry';
import { cancelIflytekMeetingRooms, formatCancelRoomResult } from './utils.js';

export const cancelRoomCommand = cli({
  site: 'iflytek_meeting',
  name: 'cancel-room',
  description: 'Cancel your pending iFlytek meeting room bookings by room keyword or all at once',
  domain: 'ipark.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  args: [
    { name: 'room-keyword', required: false, help: 'Cancel all pending bookings whose room name includes this keyword, such as 355' },
    { name: 'all', required: false, type: 'bool', help: 'Cancel all pending meeting room bookings', default: false },
  ],
  columns: ['Status', 'Room', 'Date', 'Time', 'OrderId'],
  func: async (page, kwargs) => {
    const results = await cancelIflytekMeetingRooms(page, {
      roomKeyword: kwargs['room-keyword'] ? String(kwargs['room-keyword']) : undefined,
      all: kwargs.all === true,
    });
    return formatCancelRoomResult(results);
  },
});
