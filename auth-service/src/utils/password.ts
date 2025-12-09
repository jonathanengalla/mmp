import bcrypt from "bcryptjs";

const DEFAULT_ROUNDS = 10;

export async function hashPassword(plain: string, rounds: number = DEFAULT_ROUNDS): Promise<string> {
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

