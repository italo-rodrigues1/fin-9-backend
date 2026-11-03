import { Prisma } from '../generated/client/client';
import { goalFunding } from './goal-funding';
const d = (v: number | string) => new Prisma.Decimal(v);
describe('Cash backing of savings goals', () => {
  it('reserves existing cash without increasing it', () => {
    const r = goalFunding(
      [{ id: 'a', balance: d(100) }],
      [{ goalId: 'g', accountId: 'a', amount: d(30) }],
    );
    expect(r.available.get('a')?.toNumber()).toBe(70);
    expect(r.goals.get('g')?.funded.toNumber()).toBe(30);
  });
  it('shares a shortfall proportionally and never invents cents', () => {
    const r = goalFunding(
      [{ id: 'a', balance: d(0.01) }],
      [
        { goalId: 'one', accountId: 'a', amount: d(1) },
        { goalId: 'two', accountId: 'a', amount: d(1) },
      ],
    );
    expect(r.goals.get('one')?.funded.toNumber()).toBe(0);
    expect(r.goals.get('two')?.funded.toNumber()).toBe(0);
    expect(r.available.get('a')?.toNumber()).toBe(0);
  });
  it('aggregates contributions before rounding account shares', () => {
    const r = goalFunding(
      [{ id: 'a', balance: d(0.01) }],
      [
        { goalId: 'g', accountId: 'a', amount: d(0.01) },
        { goalId: 'g', accountId: 'a', amount: d(0.01) },
      ],
    );
    expect(r.goals.get('g')?.funded.toNumber()).toBe(0.01);
  });
  it('combines accounts and treats overdrafts as zero backing', () => {
    const r = goalFunding(
      [
        { id: 'a', balance: d(-10) },
        { id: 'b', balance: d(40) },
      ],
      [
        { goalId: 'g', accountId: 'a', amount: d(20) },
        { goalId: 'g', accountId: 'b', amount: d(30) },
      ],
    );
    expect(r.goals.get('g')?.allocated.toNumber()).toBe(50);
    expect(r.goals.get('g')?.funded.toNumber()).toBe(30);
    expect(r.available.get('a')?.toNumber()).toBe(0);
  });
  it('splits spent cash according to each goal share', () => {
    const r = goalFunding(
      [{ id: 'a', balance: d(50) }],
      [
        { goalId: 'one', accountId: 'a', amount: d(75) },
        { goalId: 'two', accountId: 'a', amount: d(25) },
      ],
    );
    expect(r.goals.get('one')?.funded.toNumber()).toBe(37.5);
    expect(r.goals.get('two')?.funded.toNumber()).toBe(12.5);
  });
});
