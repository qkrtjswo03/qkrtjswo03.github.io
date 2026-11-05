import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, formatDateISO, yearInZone } from './dates.ts';

test('formatDate uses Asia/Seoul, not UTC, near midnight', () => {
  // 2026-11-05 16:00 UTC = 2026-11-06 01:00 KST
  const kstNextDay = new Date('2026-11-05T16:00:00.000Z');
  assert.equal(formatDate(kstNextDay), '2026.11.06');
  assert.equal(formatDateISO(kstNextDay), '2026-11-06');
  assert.equal(yearInZone(kstNextDay), 2026);

  // 2026-11-05 14:00 UTC = 2026-11-05 23:00 KST
  const sameDay = new Date('2026-11-05T14:00:00.000Z');
  assert.equal(formatDate(sameDay), '2026.11.05');

  // New Year in Seoul while UTC is still Dec 31
  const nye = new Date('2025-12-31T15:30:00.000Z');
  assert.equal(formatDate(nye), '2026.01.01');
  assert.equal(yearInZone(nye), 2026);
});

test('UTC midnight date-only stays the same calendar day in Seoul', () => {
  const utcMidnight = new Date('2026-11-06T00:00:00.000Z');
  assert.equal(formatDate(utcMidnight), '2026.11.06');
});
