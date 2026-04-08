import { sendCommand } from '@jackwener/opencli/browser';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/registry';

export const IFLYTEK_MEETING_ORDER_URL = 'https://ipark.iflytek.com/office-web-front/order';
export const IFLYTEK_MEETING_HOME_URL = 'https://ipark.iflytek.com/office-web-front/';
export const IFLYTEK_MEETING_MINE_URL = 'https://ipark.iflytek.com/office-web-front/mine/index';
export const IFLYTEK_MEETING_WORKSPACE = 'site:iflytek_meeting';

export interface IflytekMeetingUserInfo {
  accountName?: string;
  token?: string;
  userInfo?: {
    empName?: string;
  };
}

export interface IflytekMeetingOrderInfo {
  date?: string;
  startTime: string;
  endTime: string;
  orderId?: string;
  orderAccountName?: string;
  orderUserName?: string;
  status?: string;
  title?: string;
  titleHide?: string;
}

export interface IflytekMeetingResourceExt {
  officeId?: string;
  officeName?: string;
  officeType?: string;
  personNum?: string;
  permissionType?: string;
  timeLimitType?: string;
  singleTime?: string;
  groupType?: string;
  hasScreen?: string;
  isClear?: number | null;
  orderInfos?: IflytekMeetingOrderInfo[];
}

export interface IflytekMeetingResource {
  id: string;
  title: string;
  ext: IflytekMeetingResourceExt;
}

export interface BookRoomOptions {
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  roomKeyword?: string;
  minCapacity?: number;
  dryRun?: boolean;
}

export interface ListRoomsOptions {
  date: string;
  startTime: string;
  endTime: string;
  locationKeyword?: string;
  minCapacity?: number;
}

export interface BookRoomResult {
  status: 'success' | 'dry-run';
  room: string;
  roomId: string;
  officeId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  orderId?: string;
}

export interface ListRoomsResult {
  room: string;
  roomId: string;
  officeId: string;
  capacity: number;
  date: string;
  startTime: string;
  endTime: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface FreeSlotsOptions {
  date: string;
  roomKeyword: string;
}

export interface FreeSlotResult {
  room: string;
  roomId: string;
  officeId: string;
  date: string;
  freeSlot: string;
}

export interface CancelRoomOptions {
  roomKeyword?: string;
  all?: boolean;
}

export interface IflytekMeetingPendingOrder {
  orderId: string;
  officeName: string;
  officeId: string;
  orderDate: string;
  startTime: string;
  endTime: string;
  title: string;
}

export interface CancelRoomResult {
  status: 'cancelled';
  room: string;
  date: string;
  time: string;
  orderId: string;
}

interface RuntimeContext {
  userInfo: IflytekMeetingUserInfo;
  resources: IflytekMeetingResource[];
}

interface OrderDetailPayload {
  orderId: string;
  officeName: string;
  officeId: string;
  title: string;
  orderDate: string;
  startTime: string;
  endTime: string;
}

interface PendingOrderStatusResponse {
  pendingStatus?: string;
}

interface PendingOrdersPageResponse {
  list?: IflytekMeetingPendingOrder[];
}

type PendingOrdersResponseData =
  | PendingOrdersPageResponse
  | Record<string, PendingOrdersPageResponse | IflytekMeetingPendingOrder[]>;

function toMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new CommandExecutionError(`Invalid time format: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeLocationText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\-]/g, '');
}

function inferFloorFromTitle(title: string): string | undefined {
  const match = title.match(/(\d{3,})/);
  return match?.[1]?.[0];
}

function normalizeFloorKeyword(value: string): string {
  const chineseFloorMap: Record<string, string> = {
    一: '1',
    二: '2',
    三: '3',
    四: '4',
    五: '5',
    六: '6',
    七: '7',
    八: '8',
    九: '9',
    十: '10',
  };

  return value.replace(/([一二三四五六七八九十])楼/g, (_, numeral: string) => {
    return `${chineseFloorMap[numeral] ?? numeral}楼`;
  });
}

function matchesLocationKeyword(title: string, keyword?: string): boolean {
  const trimmed = keyword?.trim();
  if (!trimmed) return true;
  const normalizedKeyword = normalizeFloorKeyword(trimmed);

  const normalizedTitle = normalizeLocationText(title);
  const floorMatches = [...normalizedKeyword.matchAll(/(\d+)楼/g)];
  const inferredFloor = inferFloorFromTitle(title);

  for (const match of floorMatches) {
    if (normalizedTitle.includes(match[0].toLowerCase())) continue;
    if (inferredFloor === match[1]) continue;
    return false;
  }

  const remainder = normalizeLocationText(normalizedKeyword.replace(/(\d+)楼/g, ''));
  if (!remainder) return true;
  if (normalizedTitle.includes(remainder)) return true;

  const normalizedParts = normalizedKeyword
    .replace(/(\d+)楼/g, ' ')
    .split(/\s+/)
    .map((part) => normalizeLocationText(part))
    .filter(Boolean);

  return normalizedParts.length > 0 && normalizedParts.every((part) => normalizedTitle.includes(part));
}

export function selectCancelableOrders(
  orders: IflytekMeetingPendingOrder[],
  options: CancelRoomOptions,
): IflytekMeetingPendingOrder[] {
  if (orders.length === 0) {
    throw new CommandExecutionError('No pending meeting room bookings were found');
  }

  if (options.all) return orders;

  const keyword = options.roomKeyword?.trim().toLowerCase();
  if (!keyword) {
    throw new CommandExecutionError('Either roomKeyword or all must be provided');
  }

  const matches = orders.filter((order) => order.officeName?.toLowerCase().includes(keyword));
  if (matches.length === 0) {
    throw new CommandExecutionError(`No pending meeting room booking matched keyword: ${options.roomKeyword}`);
  }

  return matches;
}

export function findRoomsByKeyword(
  resources: IflytekMeetingResource[],
  keyword: string,
): IflytekMeetingResource[] {
  const trimmed = keyword.trim();
  if (!trimmed) {
    throw new CommandExecutionError('roomKeyword is required');
  }

  const matches = resources.filter((resource) => {
    const title = (resource.title || resource.ext.officeName || '').trim();
    return title ? matchesLocationKeyword(title, trimmed) : false;
  });

  if (matches.length === 0) {
    throw new CommandExecutionError(`No meeting room matched keyword: ${keyword}`);
  }

  return [...matches].sort((left, right) => left.title.localeCompare(right.title, 'zh-Hans-CN'));
}

function mergeOccupiedSlots(orders: Array<Pick<IflytekMeetingOrderInfo, 'startTime' | 'endTime'>>): TimeSlot[] {
  const normalized = orders
    .map((order) => ({ start: toMinutes(order.startTime), end: toMinutes(order.endTime) }))
    .filter((slot) => slot.start < slot.end)
    .sort((left, right) => left.start - right.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const slot of normalized) {
    const last = merged[merged.length - 1];
    if (!last || slot.start > last.end) {
      merged.push({ ...slot });
      continue;
    }
    last.end = Math.max(last.end, slot.end);
  }

  return merged.map((slot) => ({
    startTime: minutesToTime(slot.start),
    endTime: minutesToTime(slot.end),
  }));
}

export function computeFreeSlots(
  orders: Array<Pick<IflytekMeetingOrderInfo, 'startTime' | 'endTime'>>,
): TimeSlot[] {
  const occupied = mergeOccupiedSlots(orders);
  if (occupied.length === 0) {
    return [{ startTime: '00:00', endTime: '24:00' }];
  }

  const free: TimeSlot[] = [];
  let cursor = 0;

  for (const slot of occupied) {
    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);
    if (cursor < start) {
      free.push({ startTime: minutesToTime(cursor), endTime: minutesToTime(start) });
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < 24 * 60) {
    free.push({ startTime: minutesToTime(cursor), endTime: '24:00' });
  }

  return free;
}

export function pickFreeRoom(resources: IflytekMeetingResource[], options: BookRoomOptions): IflytekMeetingResource {
  const rooms = listFreeRooms(resources, {
    date: options.date,
    startTime: options.startTime,
    endTime: options.endTime,
    locationKeyword: options.roomKeyword,
    minCapacity: options.minCapacity,
  });

  return rooms[0];
}

export function listFreeRooms(resources: IflytekMeetingResource[], options: ListRoomsOptions): IflytekMeetingResource[] {
  const minCapacity = options.minCapacity ?? 0;

  const candidates = resources.filter((resource) => {
    const title = (resource.title || resource.ext.officeName || '').trim();
    if (!title) return false;
    if (!matchesLocationKeyword(title, options.locationKeyword)) return false;

    const capacity = Number(resource.ext.personNum ?? '0');
    if (Number.isFinite(capacity) && capacity < minCapacity) return false;

    const orders = resource.ext.orderInfos ?? [];
    return !orders.some((order) => overlaps(order.startTime, order.endTime, options.startTime, options.endTime));
  });

  if (candidates.length === 0) {
    throw new CommandExecutionError('No free meeting room matched the requested time window');
  }

  return [...candidates].sort((left, right) => {
    const leftCapacity = Number(left.ext.personNum ?? '0');
    const rightCapacity = Number(right.ext.personNum ?? '0');
    if (leftCapacity !== rightCapacity) return leftCapacity - rightCapacity;
    return left.title.localeCompare(right.title, 'zh-Hans-CN');
  });
}

async function navigateToOrderPage(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_MEETING_ORDER_URL);
  } catch {
    // The opencli bridge can lose the inspected target during navigation even
    // though the destination page ends up loaded in the shared Chrome tab.
  }
  await page.wait(3);
}

async function navigateToHomePage(page: IPage): Promise<void> {
  try {
    await page.goto(IFLYTEK_MEETING_HOME_URL);
  } catch {
    // Same target-switch race as the order page navigation.
  }
  await page.wait(2);
}

async function navigateToMinePage(page: IPage): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(IFLYTEK_MEETING_MINE_URL);
    } catch {
      // Same target-switch race as other navigations.
    }
    await page.wait(2);

    const state = await getSafePageState(page);
    if (state?.href?.includes('/mine/')) return;

    await page.evaluate(`
      (() => {
        location.assign(${JSON.stringify(IFLYTEK_MEETING_MINE_URL)});
      })()
    `).catch(() => {});
    await page.wait(2);
  }
}

async function adoptExistingIflytekMeetingTab(): Promise<void> {
  const activeMatches = await sendCommand('tabs', {
    op: 'find',
    workspace: IFLYTEK_MEETING_WORKSPACE,
    domain: 'ipark.iflytek.com',
    active: true,
  }) as Array<{ tabId?: number }> | null;

  const anyMatches = activeMatches && activeMatches.length > 0
    ? activeMatches
    : await sendCommand('tabs', {
        op: 'find',
        workspace: IFLYTEK_MEETING_WORKSPACE,
        domain: 'ipark.iflytek.com',
      }) as Array<{ tabId?: number }> | null;

  const tabId = anyMatches?.find((tab) => typeof tab.tabId === 'number')?.tabId;
  if (typeof tabId === 'number') {
    await sendCommand('tabs', {
      op: 'adopt',
      workspace: IFLYTEK_MEETING_WORKSPACE,
      tabId,
    });
  }
}

async function getSafePageState(page: IPage): Promise<{
  href?: string;
  title?: string;
  userInfo?: IflytekMeetingUserInfo;
  bodyText?: string;
  resources?: IflytekMeetingResource[];
}> {
  return page.evaluate(`
    (() => {
      let userInfo = {};
      try {
        userInfo = JSON.parse(window.sessionStorage?.getItem('userInfo') || '{}');
      } catch {
        userInfo = {};
      }

      const fcNode = document.querySelector('.fc')?.__k?.__k?.[0]?.__k?.[0]?.__k?.[0];
      const props = fcNode?.props || {};
      const resources = Object.values(props.resourceStore || {}).map((resource) => ({
        id: resource.id,
        title: resource.title,
        ext: resource.extendedProps || {},
      }));

      return {
        href: location.href,
        userInfo,
        resources,
        bodyText: (document.body?.innerText || '').slice(0, 400),
      };
    })()
  `) as Promise<{
    href?: string;
    title?: string;
    userInfo?: IflytekMeetingUserInfo;
    bodyText?: string;
    resources?: IflytekMeetingResource[];
  }>;
}

async function getRuntimeContext(page: IPage): Promise<RuntimeContext> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await getSafePageState(page);

    if (result?.userInfo?.token && result?.userInfo?.accountName && Array.isArray(result.resources) && result.resources.length > 0) {
      return {
        userInfo: result.userInfo,
        resources: result.resources,
      };
    }

    if (result?.bodyText && /扫码登录|账号登录|验证码登录|统一认证平台/.test(result.bodyText)) {
      throw new AuthRequiredError('ipark.iflytek.com', 'Please open Chrome and log in to the iFlytek meeting room portal first.');
    }

    await page.wait(1);
  }

  throw new CommandExecutionError('Failed to read meeting room availability from the page');
}

async function ensureAuthenticatedSession(page: IPage): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await getSafePageState(page);

    if (result?.userInfo?.token && result?.userInfo?.accountName) {
      return;
    }

    if (result?.href?.startsWith('data:') || result?.href === 'about:blank') {
      await navigateToHomePage(page);
      continue;
    }

    if (result?.bodyText && /扫码登录|账号登录|验证码登录|统一认证平台/.test(result.bodyText)) {
      throw new AuthRequiredError('ipark.iflytek.com', 'Please open Chrome and log in to the iFlytek meeting room portal first.');
    }

    if (attempt === 0) {
      await navigateToHomePage(page);
      continue;
    }

    await page.wait(1);
  }

  throw new CommandExecutionError('Failed to reuse an authenticated iFlytek meeting session');
}

async function postJson<T>(page: IPage, endpoint: string, body: unknown): Promise<T> {
  return page.evaluate(`
    (async () => {
      let userInfo = {};
      try {
        userInfo = JSON.parse(window.sessionStorage?.getItem('userInfo') || '{}');
      } catch {
        userInfo = {};
      }
      const baseApi = window.ENV_CONFIG?.baseApi || '';
      const normalized = baseApi.endsWith('/') ? baseApi.slice(0, -1) : baseApi;
      const response = await fetch(normalized + ${JSON.stringify(endpoint)}, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          token: userInfo.token,
          accountName: userInfo.accountName,
        },
        body: JSON.stringify(${JSON.stringify(body)}),
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { flag: false, msg: text, raw: text, httpStatus: response.status };
      }
    })()
  `) as Promise<T>;
}

export async function bookIflytekMeetingRoom(page: IPage, options: BookRoomOptions): Promise<BookRoomResult> {
  if (toMinutes(options.startTime) >= toMinutes(options.endTime)) {
    throw new CommandExecutionError('endTime must be later than startTime');
  }

  await adoptExistingIflytekMeetingTab().catch(() => {});
  await navigateToOrderPage(page);
  const context = await getRuntimeContext(page);
  const room = pickFreeRoom(context.resources, options);
  const title = options.title?.trim() || `${context.userInfo.userInfo?.empName || '会议'}的会议`;

  if (!room.ext.officeId) {
    throw new CommandExecutionError(`Room ${room.title} is missing officeId`);
  }

  if (options.dryRun) {
    return {
      status: 'dry-run',
      room: room.title,
      roomId: room.id,
      officeId: room.ext.officeId,
      date: options.date,
      startTime: options.startTime,
      endTime: options.endTime,
      title,
    };
  }

  const payload = {
    orderDate: options.date,
    officeId: room.ext.officeId,
    title,
    titleHide: 1,
    startTime: options.startTime,
    endTime: options.endTime,
    isZhanTing: 0,
    zhanTingOrder: { officeUserNum: '', clearHall: '', occupType: '' },
    isBatch: '',
    batchOrderCycle: { cyclePeriodStartDate: '', cyclePeriodEndDate: '', cycleFrequency: '' },
  };

  const lockResponse = await postJson<{ flag?: boolean; msg?: string; data?: string }>(
    page,
    '/order/lockOfficeAndCreateOrder',
    payload,
  );

  if (!lockResponse?.flag || !lockResponse.data) {
    throw new CommandExecutionError(lockResponse?.msg || 'Failed to lock the meeting room');
  }

  const orderId = lockResponse.data;
  const detailResponse = await postJson<{ flag?: boolean; msg?: string; data?: OrderDetailPayload }>(
    page,
    '/order/getMyOrderDetailByOrderId',
    { orderId },
  );

  if (!detailResponse?.flag || !detailResponse.data) {
    throw new CommandExecutionError(detailResponse?.msg || `Room was locked but detail lookup failed for order ${orderId}`);
  }

  const detail = detailResponse.data;
  if (detail.officeId !== room.ext.officeId || detail.startTime !== options.startTime || detail.endTime !== options.endTime) {
    throw new CommandExecutionError(`Booking verification mismatch for order ${orderId}`);
  }

  return {
    status: 'success',
    room: detail.officeName,
    roomId: room.id,
    officeId: detail.officeId,
    date: detail.orderDate,
    startTime: detail.startTime,
    endTime: detail.endTime,
    title: detail.title,
    orderId,
  };
}

export async function listIflytekMeetingRooms(page: IPage, options: ListRoomsOptions): Promise<ListRoomsResult[]> {
  if (toMinutes(options.startTime) >= toMinutes(options.endTime)) {
    throw new CommandExecutionError('endTime must be later than startTime');
  }

  await adoptExistingIflytekMeetingTab().catch(() => {});
  await navigateToOrderPage(page);
  const context = await getRuntimeContext(page);
  const rooms = listFreeRooms(context.resources, options);

  return rooms.map((room) => ({
    room: room.title,
    roomId: room.id,
    officeId: room.ext.officeId ?? '-',
    capacity: Number(room.ext.personNum ?? '0'),
    date: options.date,
    startTime: options.startTime,
    endTime: options.endTime,
  }));
}

export async function listIflytekMeetingRoomFreeSlots(page: IPage, options: FreeSlotsOptions): Promise<FreeSlotResult[]> {
  await adoptExistingIflytekMeetingTab().catch(() => {});
  await navigateToOrderPage(page);
  const context = await getRuntimeContext(page);
  const rooms = findRoomsByKeyword(context.resources, options.roomKeyword);

  const rows = rooms.flatMap((room) => {
    const freeSlots = computeFreeSlots(room.ext.orderInfos ?? []);
    return freeSlots.map((slot) => ({
      room: room.title,
      roomId: room.id,
      officeId: room.ext.officeId ?? '-',
      date: options.date,
      freeSlot: `${slot.startTime}-${slot.endTime}`,
    }));
  });

  if (rows.length === 0) {
    throw new CommandExecutionError(`No free slots were found for rooms matching keyword: ${options.roomKeyword}`);
  }

  return rows.sort((left, right) =>
    left.room.localeCompare(right.room, 'zh-Hans-CN') || left.freeSlot.localeCompare(right.freeSlot, 'zh-Hans-CN'),
  );
}

async function getPendingOrderStatuses(page: IPage): Promise<string> {
  const response = await postJson<{ flag?: boolean; msg?: string; data?: PendingOrderStatusResponse }>(
    page,
    '/user/getPersonOwnSelectBtnByAccountName',
    {},
  );

  if (!response?.flag || !response.data?.pendingStatus) {
    throw new CommandExecutionError(response?.msg || 'Failed to load pending meeting order statuses');
  }

  return response.data.pendingStatus;
}

async function getPendingOrders(page: IPage): Promise<IflytekMeetingPendingOrder[]> {
  const statusDetails = await getPendingOrderStatuses(page);
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 90);

  const formatDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  };

  const byOrderId = new Map<string, IflytekMeetingPendingOrder>();
  let cursor = new Date(today);
  let lastMessage = 'Failed to load pending meeting room bookings';

  while (cursor <= endDate) {
    const windowEnd = addDays(cursor, 6);
    const response = await postJson<{ flag?: boolean; msg?: string; data?: PendingOrdersResponseData }>(
      page,
      '/user/getMyOrderListsByCondition',
      {
        startDate: formatDate(cursor),
        endDate: formatDate(windowEnd <= endDate ? windowEnd : endDate),
        statusDetails,
        searchContext: '',
        isFinish: 0,
      },
    );

    if (!response?.flag || !response.data) {
      throw new CommandExecutionError(response?.msg || lastMessage);
    }

    const data = response.data;
    const groups = Array.isArray((data as PendingOrdersPageResponse).list)
      ? [(data as PendingOrdersPageResponse).list ?? []]
      : Object.values(data as Record<string, PendingOrdersPageResponse | IflytekMeetingPendingOrder[]>).map((value) =>
          Array.isArray(value) ? value : (value.list ?? []),
        );

    for (const order of groups.flat()) {
      byOrderId.set(order.orderId, order);
    }

    cursor = addDays(cursor, 7);
  }

  return [...byOrderId.values()];
}

export function filterFuturePendingOrders(
  orders: IflytekMeetingPendingOrder[],
  now: Date = new Date(),
): IflytekMeetingPendingOrder[] {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return [...orders]
    .filter((order) => {
      if (order.orderDate > today) return true;
      if (order.orderDate < today) return false;
      return toMinutes(order.endTime) > currentMinutes;
    })
    .sort((left, right) =>
      left.orderDate.localeCompare(right.orderDate, 'zh-Hans-CN')
      || toMinutes(left.startTime) - toMinutes(right.startTime)
      || left.officeName.localeCompare(right.officeName, 'zh-Hans-CN'),
    );
}

export async function listIflytekMeetingBookings(page: IPage): Promise<IflytekMeetingPendingOrder[]> {
  await adoptExistingIflytekMeetingTab().catch(() => {});
  await ensureAuthenticatedSession(page);
  await navigateToMinePage(page);

  const pendingOrders = await getPendingOrders(page);
  const futureOrders = filterFuturePendingOrders(pendingOrders);
  if (futureOrders.length === 0) {
    throw new CommandExecutionError('No future meeting room bookings were found');
  }

  return futureOrders;
}

export async function cancelIflytekMeetingRooms(page: IPage, options: CancelRoomOptions): Promise<CancelRoomResult[]> {
  if (!options.all && !options.roomKeyword?.trim()) {
    throw new CommandExecutionError('Use --room-keyword <text> or --all to choose bookings to cancel');
  }

  await adoptExistingIflytekMeetingTab().catch(() => {});
  await ensureAuthenticatedSession(page);
  await navigateToMinePage(page);

  const pendingOrders = await getPendingOrders(page);
  const selectedOrders = selectCancelableOrders(pendingOrders, options);
  const results: CancelRoomResult[] = [];

  for (const order of selectedOrders) {
    const response = await postJson<{ flag?: boolean; msg?: string }>(
      page,
      '/order/cancelOrderById',
      { orderId: order.orderId },
    );

    if (!response?.flag) {
      throw new CommandExecutionError(response?.msg || `Failed to cancel meeting room booking ${order.orderId}`);
    }

    results.push({
      status: 'cancelled',
      room: order.officeName,
      date: order.orderDate,
      time: `${order.startTime}-${order.endTime}`,
      orderId: order.orderId,
    });
  }

  return results;
}

export function formatBookRoomResult(result: BookRoomResult): Record<string, string>[] {
  return [{
    Status: result.status,
    Room: result.room,
    Date: result.date,
    Time: `${result.startTime}-${result.endTime}`,
    Title: result.title,
    OrderId: result.orderId ?? '-',
  }];
}

export function formatListRoomsResult(results: ListRoomsResult[]): Record<string, string>[] {
  return results.map((result) => ({
    Room: result.room,
    Capacity: String(result.capacity),
    Date: result.date,
    Time: `${result.startTime}-${result.endTime}`,
    OfficeId: result.officeId,
    RoomId: result.roomId,
  }));
}

export function formatFreeSlotsResult(results: FreeSlotResult[]): Record<string, string>[] {
  return results.map((result) => ({
    Room: result.room,
    Date: result.date,
    FreeSlot: result.freeSlot,
    OfficeId: result.officeId,
    RoomId: result.roomId,
  }));
}

export function formatListBookingsResult(results: IflytekMeetingPendingOrder[]): Record<string, string>[] {
  return results.map((result) => ({
    Room: result.officeName,
    Date: result.orderDate,
    Time: `${result.startTime}-${result.endTime}`,
    Title: result.title || '-',
    OrderId: result.orderId,
  }));
}

export function formatCancelRoomResult(results: CancelRoomResult[]): Record<string, string>[] {
  return results.map((result) => ({
    Status: result.status,
    Room: result.room,
    Date: result.date,
    Time: result.time,
    OrderId: result.orderId,
  }));
}
