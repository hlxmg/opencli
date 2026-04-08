import { cli, Strategy } from '@jackwener/opencli/registry';
import { formatListRoomsResult, listIflytekMeetingRooms } from './utils.js';

export const listRoomsCommand = cli({
  site: 'iflytek_meeting',
  name: 'list-rooms',
  description: 'List free meeting rooms from the iFlytek portal for a given time window',
  domain: 'ipark.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  args: [
    { name: 'date', required: true, help: 'Booking date in YYYY-MM-DD format' },
    { name: 'start', required: true, help: 'Start time in HH:mm format' },
    { name: 'end', required: true, help: 'End time in HH:mm format' },
    { name: 'location-keyword', required: false, help: 'Filter rooms by fuzzy location keyword such as building or floor' },
    { name: 'min-capacity', required: false, help: 'Minimum room capacity' },
  ],
  columns: ['Room', 'Capacity', 'Date', 'Time', 'OfficeId', 'RoomId'],
  func: async (page, kwargs) => {
    const results = await listIflytekMeetingRooms(page, {
      date: String(kwargs.date),
      startTime: String(kwargs.start),
      endTime: String(kwargs.end),
      locationKeyword: kwargs['location-keyword'] ? String(kwargs['location-keyword']) : undefined,
      minCapacity: kwargs['min-capacity'] ? Number(kwargs['min-capacity']) : undefined,
    });
    return formatListRoomsResult(results);
  },
});
