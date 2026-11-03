import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

/** Do not allow null to bypass validation of non-nullable optional fields. */
export const IsOptionalField = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);

/** Query strings may contain numbers; booleans, arrays and blanks are never numbers. */
export const ToNumber = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : value,
  );
