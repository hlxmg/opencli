#!/usr/bin/env node

import { BrowserBridge } from '../dist/browser/mcp.js';
import { bookIflytekMeetingRoom, IFLYTEK_MEETING_WORKSPACE } from '../dist/clis/iflytek_meeting/utils.js';

function usage() {
  console.error('Usage: node scripts/iflytek-book-room.mjs --date YYYY-MM-DD --start HH:mm --end HH:mm [--title TEXT] [--room-keyword TEXT] [--min-capacity N] [--dry-run]');
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'dry-run') {
      options.dryRun = true;
      continue;
    }
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    i += 1;
    options[key] = value;
  }
  return options;
}

const args = parseArgs(process.argv.slice(2));
if (!args.date || !args.start || !args.end) {
  usage();
  process.exit(1);
}

const mcp = new BrowserBridge();
const page = await mcp.connect({ timeout: 15, workspace: IFLYTEK_MEETING_WORKSPACE });

const result = await bookIflytekMeetingRoom(page, {
  date: String(args.date),
  startTime: String(args.start),
  endTime: String(args.end),
  title: args.title ? String(args.title) : undefined,
  roomKeyword: args['room-keyword'] ? String(args['room-keyword']) : undefined,
  minCapacity: args['min-capacity'] ? Number(args['min-capacity']) : undefined,
  dryRun: args.dryRun === true,
});

console.log(JSON.stringify(result, null, 2));
