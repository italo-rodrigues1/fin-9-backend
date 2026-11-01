/** Financial calendar used by the Brazilian app; stored DATE values keep their original day. */
export function businessDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now),
    part = (name: string) => parts.find((p) => p.type === name)!.value;
  return new Date(
    part('year') + '-' + part('month') + '-' + part('day') + 'T00:00:00.000Z',
  );
}
