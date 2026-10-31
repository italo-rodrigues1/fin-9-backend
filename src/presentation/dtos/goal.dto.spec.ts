import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveGoalDto, SaveGoalContributionDto, GoalPageDto } from './goal.dto';
describe('Goals input validation', () => {
  it('accepts and clears optional deadlines', async () => {
    for (const deadline of [undefined, null, '2028-02-29'])
      expect(
        await validate(
          plainToInstance(SaveGoalDto, {
            name: ' Reserva ',
            targetAmount: 100,
            deadline,
          }),
        ),
      ).toHaveLength(0);
  });
  it.each([0, -1, 1.001, 1000000000, NaN, Infinity])(
    'rejects invalid target %s',
    async (targetAmount) => {
      expect(
        (
          await validate(
            plainToInstance(SaveGoalDto, { name: 'Meta', targetAmount }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it('rejects blank names, invalid calendar dates and excess text', async () => {
    for (const data of [
      { name: '   ', targetAmount: 10 },
      { name: 'Meta', targetAmount: 10, deadline: '2026-02-30' },
      { name: 'a'.repeat(101), targetAmount: 10 },
    ])
      expect(
        (await validate(plainToInstance(SaveGoalDto, data))).length,
      ).toBeGreaterThan(0);
  });
  it('validates contribution account, money, date and retry key', async () => {
    expect(
      (
        await validate(
          plainToInstance(SaveGoalContributionDto, {
            accountId: 'foreign',
            amount: 0,
            date: '2026-02-30',
            requestId: 'bad',
          }),
        )
      ).length,
    ).toBe(4);
  });
  it('limits and normalizes history pagination', async () => {
    expect(
      await validate(plainToInstance(GoalPageDto, { skip: '30', take: '30' })),
    ).toHaveLength(0);
    expect(
      (await validate(plainToInstance(GoalPageDto, { skip: -1, take: 1000 })))
        .length,
    ).toBe(2);
  });
});
