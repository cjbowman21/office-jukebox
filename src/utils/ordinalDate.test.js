import { describe, expect, test } from 'vitest';
import {
  formatDayOfYear,
  formatOrdinalDate,
  getDayOfYear,
  isLeapYear,
} from './ordinalDate';

describe('ordinal date helpers', () => {
  test('formats January 1 as day 001', () => {
    const date = new Date(2026, 0, 1);

    expect(getDayOfYear(date)).toBe(1);
    expect(formatDayOfYear(getDayOfYear(date))).toBe('001');
  });

  test('formats December 31 as 365 or 366 depending on leap year', () => {
    expect(getDayOfYear(new Date(2023, 11, 31))).toBe(365);
    expect(getDayOfYear(new Date(2024, 11, 31))).toBe(366);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
  });

  test('formats leap day as day 060', () => {
    const date = new Date(2024, 1, 29);

    expect(getDayOfYear(date)).toBe(60);
    expect(formatDayOfYear(getDayOfYear(date))).toBe('060');
  });

  test('formats full ordinal dates as YYYYDOY', () => {
    expect(formatOrdinalDate(new Date(2026, 4, 11))).toBe('2026131');
  });
});
