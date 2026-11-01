import { businessDay } from './business-day';
describe('Brazilian business dates', () => {
  it('does not turn the day early at UTC midnight', () => {
    expect(
      businessDay(new Date('2026-11-01T00:30:00Z')).toISOString().slice(0, 10),
    ).toBe('2026-10-31');
    expect(
      businessDay(new Date('2026-11-01T03:00:00Z')).toISOString().slice(0, 10),
    ).toBe('2026-11-01');
  });
  it('preserves leap days and the year boundary', () => {
    expect(
      businessDay(new Date('2028-03-01T01:00:00Z')).toISOString().slice(0, 10),
    ).toBe('2028-02-29');
    expect(
      businessDay(new Date('2027-01-01T01:00:00Z')).toISOString().slice(0, 10),
    ).toBe('2026-12-31');
  });
});
