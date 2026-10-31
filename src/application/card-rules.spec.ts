import { Prisma } from '@prisma/client';
import { cardSchedule } from './card-rules';
const schedule = (
  date: string,
  closing = 10,
  due = 15,
  count = 1,
  total = 100,
) =>
  cardSchedule(new Date(date), closing, due, count, new Prisma.Decimal(total));
describe('Credit card cycles and exact installments', () => {
  it('keeps purchases before closing in the current cycle', () => {
    const [p] = schedule('2026-10-09');
    expect(p.closingDate.toISOString().slice(0, 10)).toBe('2026-10-10');
    expect(p.dueDate.toISOString().slice(0, 10)).toBe('2026-10-15');
  });
  it('moves purchases on and after closing to the next cycle', () => {
    for (const date of ['2026-10-10', '2026-10-31'])
      expect(schedule(date)[0].month).toBe(11);
  });
  it('places smaller or equal due days in the following month', () => {
    expect(
      schedule('2026-12-01', 20, 5)[0].dueDate.toISOString().slice(0, 10),
    ).toBe('2027-01-05');
    expect(
      schedule('2026-12-01', 20, 20)[0].dueDate.toISOString().slice(0, 10),
    ).toBe('2027-01-20');
  });
  it('clamps short months and recovers the original day, including leap years', () => {
    const rows = schedule('2028-01-31', 31, 5, 3);
    expect(rows.map((r) => r.closingDate.toISOString().slice(0, 10))).toEqual([
      '2028-02-29',
      '2028-03-31',
      '2028-04-30',
    ]);
    expect(
      schedule('2027-02-28', 31, 31)[0].closingDate.toISOString().slice(0, 10),
    ).toBe('2027-03-31');
  });
  it('splits cents exactly and allocates the remainder to the first installments', () => {
    const rows = schedule('2026-10-01', 10, 15, 3, 100);
    expect(rows.map((r) => r.amount.toNumber())).toEqual([33.34, 33.33, 33.33]);
    expect(
      rows.reduce((s, r) => s.plus(r.amount), new Prisma.Decimal(0)).toNumber(),
    ).toBe(100);
  });
  it('never creates zero-valued installments or invalid cycles', () => {
    expect(() => schedule('2026-10-01', 10, 15, 3, 0.02)).toThrow();
    expect(() => schedule('2026-10-01', 0)).toThrow();
    expect(() => schedule('2026-10-01', 10, 15, 37)).toThrow();
    expect(() => schedule('not-a-day')).toThrow();
  });
  it('preserves exact totals for 1 to 36 installments', () => {
    for (let count = 1; count <= 36; count++) {
      const rows = schedule('2026-12-31', 31, 5, count, 1234.57);
      expect(
        rows
          .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0))
          .toNumber(),
      ).toBe(1234.57);
      expect(rows.every((r) => r.amount.gt(0))).toBe(true);
    }
  });
});
