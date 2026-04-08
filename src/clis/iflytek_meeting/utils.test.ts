import { describe, expect, it } from 'vitest';
import {
  computeFreeSlots,
  findRoomsByKeyword,
  formatBookRoomResult,
  formatCancelRoomResult,
  formatFreeSlotsResult,
  formatListBookingsResult,
  formatListRoomsResult,
  filterFuturePendingOrders,
  listFreeRooms,
  pickFreeRoom,
  selectCancelableOrders,
  type IflytekMeetingPendingOrder,
  type IflytekMeetingResource,
} from './utils.js';

function resource(title: string, personNum: string, orderInfos: Array<{ startTime: string; endTime: string }>): IflytekMeetingResource {
  return {
    id: title,
    title,
    ext: {
      officeId: `${title}-office`,
      personNum,
      orderInfos,
    },
  };
}

function realisticRooms(): IflytekMeetingResource[] {
  return [
    resource('XZ-A1北区-370', '6', []),
    resource('XZ-A1-521洽谈室', '4', []),
    resource('A1北区-355洽谈室', '5', []),
    resource('XZ-A1北区-350', '8', []),
    resource('XZ-A1北区-372', '10', []),
    resource('XZ-A1北区-365', '24', []),
    resource('XZ-A1北区-366', '6', []),
    resource('XZ-A1北区-369', '14', []),
  ];
}

function pendingOrder(overrides: Partial<IflytekMeetingPendingOrder> = {}): IflytekMeetingPendingOrder {
  return {
    orderId: 'order-1',
    officeName: 'A1北区-355洽谈室',
    officeId: 'office-1',
    orderDate: '2026-03-31',
    startTime: '15:00',
    endTime: '16:00',
    title: '会议',
    ...overrides,
  };
}

describe('pickFreeRoom', () => {
  it('prefers the smallest free room', () => {
    const picked = pickFreeRoom([
      resource('大会议室', '20', []),
      resource('小会议室', '4', []),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(picked.title).toBe('小会议室');
  });

  it('skips rooms that overlap the requested slot', () => {
    const picked = pickFreeRoom([
      resource('已占用', '4', [{ startTime: '15:00', endTime: '16:00' }]),
      resource('可用', '6', [{ startTime: '13:00', endTime: '14:00' }]),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(picked.title).toBe('可用');
  });

  it('supports keyword and capacity filters together', () => {
    const picked = pickFreeRoom([
      resource('A1北区-355洽谈室', '5', []),
      resource('XZ-A1北区-372', '10', []),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
      roomKeyword: '372',
      minCapacity: 8,
    });

    expect(picked.title).toBe('XZ-A1北区-372');
  });

  it('returns all matching free rooms ordered by smaller capacity first', () => {
    const rooms = listFreeRooms([
      resource('A1北区-372', '10', []),
      resource('A1北区-355洽谈室', '5', []),
      resource('A1北区-360', '20', [{ startTime: '15:00', endTime: '15:30' }]),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
      locationKeyword: 'A1北区',
      minCapacity: 4,
    });

    expect(rooms.map((room) => room.title)).toEqual([
      'A1北区-355洽谈室',
      'A1北区-372',
    ]);
  });

  it('supports location keyword filtering separately from booking keyword', () => {
    const rooms = listFreeRooms([
      resource('A1北区-355洽谈室', '5', []),
      resource('B2南区-501', '8', []),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
      locationKeyword: 'B2南区',
    });

    expect(rooms.map((room) => room.title)).toEqual(['B2南区-501']);
  });

  it('matches floor-style location keywords against room number prefixes', () => {
    const rooms = listFreeRooms([
      resource('A1北区-355洽谈室', '5', []),
      resource('XZ-A1北区-372', '10', []),
      resource('XZ-A1北区-521洽谈室', '4', []),
    ], {
      date: '2026-03-31',
      startTime: '20:00',
      endTime: '21:00',
      locationKeyword: 'A1北区 3楼',
      minCapacity: 4,
    });

    expect(rooms.map((room) => room.title)).toEqual([
      'A1北区-355洽谈室',
      'XZ-A1北区-372',
    ]);
  });

  it('keeps rooms whose capacity is exactly the minimum threshold', () => {
    const rooms = listFreeRooms([
      resource('A1北区-355洽谈室', '4', []),
      resource('A1北区-372会议室', '3', []),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
      minCapacity: 4,
    });

    expect(rooms.map((room) => room.title)).toEqual(['A1北区-355洽谈室']);
  });

  it('does not treat touching intervals as overlap', () => {
    const picked = pickFreeRoom([
      resource('A1北区-355洽谈室', '4', [{ startTime: '09:00', endTime: '10:00' }]),
    ], {
      date: '2026-03-31',
      startTime: '10:00',
      endTime: '11:00',
    });

    expect(picked.title).toBe('A1北区-355洽谈室');
  });

  it('sorts same-capacity rooms by title', () => {
    const rooms = listFreeRooms([
      resource('B会议室', '6', []),
      resource('A会议室', '6', []),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(rooms.map((room) => room.title)).toEqual(['A会议室', 'B会议室']);
  });

  it('skips rooms whose title is empty after trimming', () => {
    const rooms = listFreeRooms([
      resource('   ', '4', []),
      resource('A1北区-355洽谈室', '4', []),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(rooms.map((room) => room.title)).toEqual(['A1北区-355洽谈室']);
  });

  it('throws when no room matches the filters', () => {
    expect(() => listFreeRooms([
      resource('A1北区-355洽谈室', '4', [{ startTime: '15:00', endTime: '16:00' }]),
    ], {
      date: '2026-03-31',
      startTime: '15:00',
      endTime: '16:00',
    })).toThrow('No free meeting room matched the requested time window');
  });
});

describe('findRoomsByKeyword', () => {
  it('returns all rooms that match the fuzzy keyword', () => {
    const rooms = findRoomsByKeyword([
      resource('A1北区-355洽谈室', '4', []),
      resource('A1北区-355大会议室', '8', []),
      resource('A1北区-372会议室', '10', []),
    ], '355');

    expect(rooms.map((room) => room.title)).toEqual([
      'A1北区-355大会议室',
      'A1北区-355洽谈室',
    ]);
  });

  it('throws when no room matches the keyword', () => {
    expect(() => findRoomsByKeyword([
      resource('A1北区-355洽谈室', '4', []),
    ], '999')).toThrow('No meeting room matched keyword');
  });

  it('throws when keyword is empty', () => {
    expect(() => findRoomsByKeyword([
      resource('A1北区-355洽谈室', '4', []),
    ], '   ')).toThrow('roomKeyword is required');
  });

  it('matches keywords while ignoring spaces, hyphens, and parentheses', () => {
    const rooms = findRoomsByKeyword([
      resource('A1北区-355（洽谈室）', '4', []),
    ], 'A1 北区 355 洽谈室');

    expect(rooms.map((room) => room.title)).toEqual(['A1北区-355（洽谈室）']);
  });

  it('matches floor-only keywords by inferring floor from the room number prefix', () => {
    const rooms = findRoomsByKeyword([
      resource('A1北区-355洽谈室', '4', []),
      resource('A1北区-521洽谈室', '4', []),
    ], '3楼');

    expect(rooms.map((room) => room.title)).toEqual(['A1北区-355洽谈室']);
  });

  it('matches chinese numeral floor keywords by inferring floor from the room number prefix', () => {
    const rooms = findRoomsByKeyword([
      resource('A1北区-355洽谈室', '4', []),
      resource('A1北区-521洽谈室', '4', []),
    ], '三楼');

    expect(rooms.map((room) => room.title)).toEqual(['A1北区-355洽谈室']);
  });

  it.each([
    ['一楼', []],
    ['二楼', []],
    ['三楼', ['A1北区-355洽谈室']],
    ['四楼', []],
    ['五楼', ['A1北区-521洽谈室']],
  ])('matches chinese numeral floor keyword %s', (keyword, expectedTitles) => {
    const action = () => findRoomsByKeyword([
      resource('A1北区-355洽谈室', '4', []),
      resource('A1北区-521洽谈室', '4', []),
    ], keyword);

    if (expectedTitles.length === 0) {
      expect(action).toThrow('No meeting room matched keyword');
      return;
    }

    expect(action().map((room) => room.title)).toEqual(expectedTitles);
  });

  it.each([
    ['355', ['A1北区-355洽谈室']],
    ['372', ['XZ-A1北区-372']],
    ['A1北区 3楼', ['A1北区-355洽谈室', 'XZ-A1北区-350', 'XZ-A1北区-365', 'XZ-A1北区-366', 'XZ-A1北区-369', 'XZ-A1北区-370', 'XZ-A1北区-372']],
    ['A1北区 三楼', ['A1北区-355洽谈室', 'XZ-A1北区-350', 'XZ-A1北区-365', 'XZ-A1北区-366', 'XZ-A1北区-369', 'XZ-A1北区-370', 'XZ-A1北区-372']],
    ['北区372', ['XZ-A1北区-372']],
    ['355洽谈室', ['A1北区-355洽谈室']],
    ['A1 372', ['XZ-A1北区-372']],
    ['a1北区372', ['XZ-A1北区-372']],
    ['北区 355', ['A1北区-355洽谈室']],
  ])('matches realistic keyword %s', (keyword, expectedTitles) => {
    const rooms = findRoomsByKeyword(realisticRooms(), keyword);
    expect(rooms.map((room) => room.title)).toEqual(expectedTitles);
  });
});

describe('computeFreeSlots', () => {
  it('returns the whole day when there are no bookings', () => {
    expect(computeFreeSlots([])).toEqual([
      { startTime: '00:00', endTime: '24:00' },
    ]);
  });

  it('returns gaps between occupied intervals', () => {
    expect(computeFreeSlots([
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '14:00', endTime: '15:30' },
    ])).toEqual([
      { startTime: '00:00', endTime: '09:00' },
      { startTime: '10:00', endTime: '14:00' },
      { startTime: '15:30', endTime: '24:00' },
    ]);
  });

  it('merges overlapping occupied intervals before computing gaps', () => {
    expect(computeFreeSlots([
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '09:30', endTime: '11:00' },
      { startTime: '11:00', endTime: '12:00' },
    ])).toEqual([
      { startTime: '00:00', endTime: '09:00' },
      { startTime: '12:00', endTime: '24:00' },
    ]);
  });

  it('returns no slots when the whole day is occupied', () => {
    expect(computeFreeSlots([
      { startTime: '00:00', endTime: '24:00' },
    ])).toEqual([]);
  });

  it('handles bookings that start at midnight', () => {
    expect(computeFreeSlots([
      { startTime: '00:00', endTime: '09:00' },
    ])).toEqual([
      { startTime: '09:00', endTime: '24:00' },
    ]);
  });

  it('handles bookings that end at the end of the day', () => {
    expect(computeFreeSlots([
      { startTime: '22:00', endTime: '24:00' },
    ])).toEqual([
      { startTime: '00:00', endTime: '22:00' },
    ]);
  });

  it('sorts unordered bookings before computing gaps', () => {
    expect(computeFreeSlots([
      { startTime: '14:00', endTime: '15:00' },
      { startTime: '09:00', endTime: '10:00' },
    ])).toEqual([
      { startTime: '00:00', endTime: '09:00' },
      { startTime: '10:00', endTime: '14:00' },
      { startTime: '15:00', endTime: '24:00' },
    ]);
  });

  it('ignores invalid intervals whose start is not earlier than end', () => {
    expect(computeFreeSlots([
      { startTime: '11:00', endTime: '11:00' },
      { startTime: '13:00', endTime: '12:00' },
    ])).toEqual([
      { startTime: '00:00', endTime: '24:00' },
    ]);
  });
});

describe('formatFreeSlotsResult', () => {
  it('formats free-slot rows for CLI output', () => {
    expect(formatFreeSlotsResult([{
      room: 'A1北区-355洽谈室',
      roomId: 'room-1',
      officeId: 'office-1',
      date: '2026-04-07',
      freeSlot: '10:00-14:00',
    }])).toEqual([{
      Room: 'A1北区-355洽谈室',
      Date: '2026-04-07',
      FreeSlot: '10:00-14:00',
      OfficeId: 'office-1',
      RoomId: 'room-1',
    }]);
  });
});

describe('formatters', () => {
  it('formats book-room results', () => {
    expect(formatBookRoomResult({
      status: 'success',
      room: 'A1北区-355洽谈室',
      roomId: 'room-1',
      officeId: 'office-1',
      date: '2026-04-08',
      startTime: '10:00',
      endTime: '11:00',
      title: '周会',
      orderId: 'order-1',
    })).toEqual([{
      Status: 'success',
      Room: 'A1北区-355洽谈室',
      Date: '2026-04-08',
      Time: '10:00-11:00',
      Title: '周会',
      OrderId: 'order-1',
    }]);
  });

  it('formats list-rooms results', () => {
    expect(formatListRoomsResult([{
      room: 'A1北区-355洽谈室',
      roomId: 'room-1',
      officeId: 'office-1',
      capacity: 4,
      date: '2026-04-08',
      startTime: '10:00',
      endTime: '11:00',
    }])).toEqual([{
      Room: 'A1北区-355洽谈室',
      Capacity: '4',
      Date: '2026-04-08',
      Time: '10:00-11:00',
      OfficeId: 'office-1',
      RoomId: 'room-1',
    }]);
  });

  it('formats cancel-room results', () => {
    expect(formatCancelRoomResult([{
      status: 'cancelled',
      room: 'A1北区-355洽谈室',
      date: '2026-04-08',
      time: '10:00-11:00',
      orderId: 'order-1',
    }])).toEqual([{
      Status: 'cancelled',
      Room: 'A1北区-355洽谈室',
      Date: '2026-04-08',
      Time: '10:00-11:00',
      OrderId: 'order-1',
    }]);
  });
});

describe('realistic room matching', () => {
  it('filters realistic room names by a north-area room number keyword', () => {
    const rooms = listFreeRooms(realisticRooms(), {
      date: '2026-04-08',
      startTime: '14:00',
      endTime: '15:00',
      locationKeyword: '北区372',
    });

    expect(rooms.map((room) => room.title)).toEqual(['XZ-A1北区-372']);
  });

  it('filters realistic room names by a floor-style keyword', () => {
    const rooms = listFreeRooms(realisticRooms(), {
      date: '2026-04-08',
      startTime: '14:00',
      endTime: '15:00',
      locationKeyword: 'A1北区 3楼',
    });

    expect(rooms.map((room) => room.title)).toEqual([
      'A1北区-355洽谈室',
      'XZ-A1北区-366',
      'XZ-A1北区-370',
      'XZ-A1北区-350',
      'XZ-A1北区-372',
      'XZ-A1北区-369',
      'XZ-A1北区-365',
    ]);
  });

  it('picks the smallest realistic room among multiple fuzzy matches', () => {
    const picked = pickFreeRoom(realisticRooms(), {
      date: '2026-04-08',
      startTime: '14:00',
      endTime: '15:00',
      roomKeyword: 'A1北区 3楼',
    });

    expect(picked.title).toBe('A1北区-355洽谈室');
  });

  it('keeps minimum capacity precedence with realistic room names', () => {
    const picked = pickFreeRoom(realisticRooms(), {
      date: '2026-04-08',
      startTime: '14:00',
      endTime: '15:00',
      roomKeyword: 'A1北区 3楼',
      minCapacity: 10,
    });

    expect(picked.title).toBe('XZ-A1北区-372');
  });
});

describe('filterFuturePendingOrders', () => {
  it('filters out bookings that already ended earlier today', () => {
    const results = filterFuturePendingOrders([
      pendingOrder({
        orderId: 'past',
        orderDate: '2026-04-07',
        startTime: '08:00',
        endTime: '09:00',
      }),
      pendingOrder({
        orderId: 'future',
        orderDate: '2026-04-07',
        startTime: '11:00',
        endTime: '12:00',
      }),
    ], new Date('2026-04-07T10:00:00+08:00'));

    expect(results.map((order) => order.orderId)).toEqual(['future']);
  });

  it('keeps future bookings on later dates and sorts by date then start time', () => {
    const results = filterFuturePendingOrders([
      pendingOrder({ orderId: 'b', orderDate: '2026-04-08', startTime: '10:00', endTime: '11:00' }),
      pendingOrder({ orderId: 'a', orderDate: '2026-04-07', startTime: '11:00', endTime: '12:00' }),
      pendingOrder({ orderId: 'c', orderDate: '2026-04-07', startTime: '14:00', endTime: '15:00' }),
    ], new Date('2026-04-07T10:00:00+08:00'));

    expect(results.map((order) => order.orderId)).toEqual(['a', 'c', 'b']);
  });

  it('drops bookings on past dates', () => {
    const results = filterFuturePendingOrders([
      pendingOrder({ orderId: 'past-date', orderDate: '2026-04-06', startTime: '18:00', endTime: '19:00' }),
      pendingOrder({ orderId: 'future-date', orderDate: '2026-04-09', startTime: '10:00', endTime: '11:00' }),
    ], new Date('2026-04-08T10:00:00+08:00'));

    expect(results.map((order) => order.orderId)).toEqual(['future-date']);
  });

  it('keeps same-day bookings whose end time is still in the future', () => {
    const results = filterFuturePendingOrders([
      pendingOrder({ orderId: 'ongoing', orderDate: '2026-04-08', startTime: '09:30', endTime: '10:30' }),
    ], new Date('2026-04-08T10:00:00+08:00'));

    expect(results.map((order) => order.orderId)).toEqual(['ongoing']);
  });

  it('sorts same-date same-start bookings by room name', () => {
    const results = filterFuturePendingOrders([
      pendingOrder({ orderId: 'b', orderDate: '2026-04-08', startTime: '14:00', endTime: '15:00', officeName: 'B会议室' }),
      pendingOrder({ orderId: 'a', orderDate: '2026-04-08', startTime: '14:00', endTime: '15:00', officeName: 'A会议室' }),
    ], new Date('2026-04-08T10:00:00+08:00'));

    expect(results.map((order) => order.orderId)).toEqual(['a', 'b']);
  });
});

describe('formatListBookingsResult', () => {
  it('formats pending bookings for CLI output', () => {
    expect(formatListBookingsResult([
      pendingOrder({
        orderId: 'order-1',
        officeName: 'A1北区-355洽谈室',
        orderDate: '2026-04-07',
        startTime: '14:00',
        endTime: '15:00',
        title: '周会',
      }),
    ])).toEqual([{
      Room: 'A1北区-355洽谈室',
      Date: '2026-04-07',
      Time: '14:00-15:00',
      Title: '周会',
      OrderId: 'order-1',
    }]);
  });
});

describe('selectCancelableOrders', () => {
  it('throws when there are no pending bookings', () => {
    expect(() => selectCancelableOrders([], { roomKeyword: '355' })).toThrow('No pending meeting room bookings were found');
  });

  it('throws when neither room keyword nor all is provided', () => {
    expect(() => selectCancelableOrders([
      pendingOrder(),
    ], {})).toThrow('Either roomKeyword or all must be provided');
  });

  it('selects all matching pending orders by room keyword', () => {
    const orders = selectCancelableOrders([
      pendingOrder({ orderId: '1', officeName: 'A1北区-355洽谈室' }),
      pendingOrder({ orderId: '2', officeName: 'XZ-A1北区-355' }),
      pendingOrder({ orderId: '3', officeName: 'XZ-A1北区-372' }),
    ], {
      roomKeyword: '355',
      all: false,
    });

    expect(orders.map((order) => order.orderId)).toEqual(['1', '2']);
  });

  it('selects all pending orders when all flag is enabled', () => {
    const orders = selectCancelableOrders([
      pendingOrder({ orderId: '1' }),
      pendingOrder({ orderId: '2', officeName: 'XZ-A1北区-372' }),
    ], {
      all: true,
    });

    expect(orders.map((order) => order.orderId)).toEqual(['1', '2']);
  });

  it('throws when no booking matches the keyword', () => {
    expect(() => selectCancelableOrders([
      pendingOrder({ officeName: 'A1北区-372会议室' }),
    ], { roomKeyword: '355' })).toThrow('No pending meeting room booking matched keyword');
  });

  it('matches room keywords case-insensitively', () => {
    const orders = selectCancelableOrders([
      pendingOrder({ orderId: '1', officeName: 'Room ABC-355' }),
    ], { roomKeyword: 'abc-355' });

    expect(orders.map((order) => order.orderId)).toEqual(['1']);
  });
});
