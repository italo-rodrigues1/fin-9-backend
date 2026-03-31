import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterDto } from './auth.dto';

async function validatePassword(password: string) {
  const dto = plainToInstance(RegisterDto, {
    name: 'Test User',
    email: 'test@example.com',
    password,
  });
  return validate(dto);
}

describe('RegisterDto - password validation', () => {
  it('deve falhar com senha menor que 8 caracteres', async () => {
    const errors = await validatePassword('Ab1');
    const passwordErrors = errors.filter((e) => e.property === 'password');
    expect(passwordErrors.length).toBeGreaterThan(0);
  });

  it('deve falhar com senha sem letra maiúscula', async () => {
    const errors = await validatePassword('abcdefg1');
    const passwordErrors = errors.filter((e) => e.property === 'password');
    expect(passwordErrors.length).toBeGreaterThan(0);
  });

  it('deve falhar com senha sem número', async () => {
    const errors = await validatePassword('Abcdefgh');
    const passwordErrors = errors.filter((e) => e.property === 'password');
    expect(passwordErrors.length).toBeGreaterThan(0);
  });

  it('deve passar com senha válida (>= 8 chars, maiúscula e número)', async () => {
    const errors = await validatePassword('Abcdefg1');
    const passwordErrors = errors.filter((e) => e.property === 'password');
    expect(passwordErrors.length).toBe(0);
  });
});
