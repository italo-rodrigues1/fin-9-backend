import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
export const currentDay = () => new Date(new Date().toISOString().slice(0, 10));
export function calendarDay(year: number, month: number, day: number) {
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
    ),
  );
}
export function cardSchedule(
  date: Date,
  closingDay: number,
  dueDay: number,
  count: number,
  total: Prisma.Decimal,
) {
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth();
  if (
    !Number.isFinite(date.getTime()) ||
    year < 1900 ||
    year > 9990 ||
    count < 1 ||
    count > 36 ||
    !Number.isInteger(count) ||
    closingDay < 1 ||
    closingDay > 31 ||
    dueDay < 1 ||
    dueDay > 31 ||
    !Number.isInteger(closingDay) ||
    !Number.isInteger(dueDay)
  )
    throw new BadRequestException('Data, ciclo ou parcelamento inválido.');
  const cents = total.mul(100);
  if (!cents.isInteger() || cents.lt(count))
    throw new BadRequestException('Cada parcela deve ter ao menos um centavo.');
  const first = month + (date >= calendarDay(year, month, closingDay) ? 1 : 0),
    base = cents.div(count).floor(),
    remainder = cents.mod(count).toNumber();
  return Array.from({ length: count }, (_, index) => {
    const anchor = new Date(Date.UTC(year, first + index, 1)),
      y = anchor.getUTCFullYear(),
      m = anchor.getUTCMonth();
    return {
      number: index + 1,
      year: y,
      month: m + 1,
      closingDate: calendarDay(y, m, closingDay),
      dueDate: calendarDay(y, m + (dueDay <= closingDay ? 1 : 0), dueDay),
      amount: base.plus(index < remainder ? 1 : 0).div(100),
    };
  });
}
