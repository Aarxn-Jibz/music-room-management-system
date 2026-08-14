import { describe, it, expect } from 'vitest';
import {
  MS_PER_DAY,
  dayIndexWithinWeek,
  describeUtcInstant,
  formatTabName,
  formatWeekLabel,
  hhMmToMs,
  utcDayForGridIndex,
  weekMondayUtc,
} from './time.js';

describe('weekMondayUtc', () => {
  it('maps a Sunday to the Monday of its week', () => {
    // Sunday 2026-08-16 15:30 UTC
    const sunday = Date.UTC(2026, 7, 16, 15, 30, 0);
    expect(weekMondayUtc(sunday)).toBe(Date.UTC(2026, 7, 10));
  });

  it('returns the same day for a Monday', () => {
    const monday = Date.UTC(2026, 7, 10, 8, 0, 0);
    expect(weekMondayUtc(monday)).toBe(Date.UTC(2026, 7, 10));
  });

  it('maps a mid-week day to the start of its week', () => {
    // Wednesday 2026-08-12
    expect(weekMondayUtc(Date.UTC(2026, 7, 12, 0, 0, 0))).toBe(Date.UTC(2026, 7, 10));
  });

  it('handles a week crossing a month boundary', () => {
    // Thursday 2026-10-01 -> Monday 2026-09-28
    expect(weekMondayUtc(Date.UTC(2026, 9, 1, 12, 0, 0))).toBe(Date.UTC(2026, 8, 28));
  });

  it('handles a week crossing a year boundary', () => {
    // Thursday 2026-01-01 -> Monday 2025-12-29
    expect(weekMondayUtc(Date.UTC(2026, 0, 1, 12, 0, 0))).toBe(Date.UTC(2025, 11, 29));
  });
});

describe('formatWeekLabel / formatTabName', () => {
  it('produces the deterministic weekly tab name', () => {
    expect(formatWeekLabel(Date.UTC(2026, 7, 10))).toBe('Week of 2026-08-10');
  });

  it('appends an admin prefix while keeping determinism', () => {
    const monday = Date.UTC(2026, 7, 10);
    expect(formatTabName(null, monday)).toBe('Week of 2026-08-10');
    expect(formatTabName('', monday)).toBe('Week of 2026-08-10');
    expect(formatTabName('ACM Studio', monday)).toBe('ACM Studio - Week of 2026-08-10');
    expect(formatTabName('  ACM Studio  ', monday)).toBe('ACM Studio - Week of 2026-08-10');
  });
});

describe('day helpers', () => {
  it('maps UTC days to a Monday-first week grid', () => {
    expect(dayIndexWithinWeek(1)).toBe(0); // Monday
    expect(dayIndexWithinWeek(0)).toBe(6); // Sunday
    expect(dayIndexWithinWeek(5)).toBe(4); // Saturday
  });

  it('round-trips between grid index and UTC day', () => {
    for (let i = 0; i < 7; i++) {
      expect(dayIndexWithinWeek(utcDayForGridIndex(i))).toBe(i);
    }
  });

  it('parses HH:MM to milliseconds of day', () => {
    expect(hhMmToMs('09:00')).toBe(9 * 60 * 60 * 1000);
    expect(hhMmToMs('23:30')).toBe(23 * 60 * 60 * 1000 + 30 * 60 * 1000);
  });
});

describe('describeUtcInstant', () => {
  it('reports Sunday 15:30 UTC as Sunday 21:00 IST (UTC+5:30)', () => {
    // Sunday 2026-08-16 15:30 UTC
    const labels = describeUtcInstant(Date.UTC(2026, 7, 16, 15, 30, 0));
    expect(labels.utc).toBe('2026-08-16 15:30:00');
    expect(labels.ist).toBe('2026-08-16 21:00:00');
  });

  it('shifts the IST label across midnight', () => {
    // Sunday 2026-08-16 23:00 UTC -> Monday 2026-08-17 04:30 IST
    const labels = describeUtcInstant(Date.UTC(2026, 7, 16, 23, 0, 0));
    expect(labels.ist).toBe('2026-08-17 04:30:00');
  });

  it('matches the 7-day week constant', () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
  });
});
