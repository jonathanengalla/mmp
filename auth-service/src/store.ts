import bcrypt from "bcryptjs";

export type AuthUser = {
  id: string;
  tenantId: string;
  memberId: string;
  email: string;
  passwordHash: string;
  status: "active" | "pending" | "inactive";
  roles: string[];
  mfaEnabled: boolean;
};

const users: AuthUser[] = [];
const refreshTokens = new Map<string, string>(); // token -> userId

// Dev-only seed user for local testing.
// TODO: Replace with proper DB seed or remove before production.
export async function seedDevUser() {
  const existing = users.find((u) => u.email === "admin@test.local");
  if (existing) return;

  const passwordHash = await bcrypt.hash("password123", 10);
  users.push({
    id: "dev-1",
    tenantId: "t1",
    memberId: "m-dev",
    email: "admin@test.local",
    passwordHash,
    status: "active",
    roles: ["admin", "member", "event_manager", "finance_manager", "communications_manager"],
    mfaEnabled: false,
  });
  console.log("[auth-store] Seeded dev user admin@test.local / password123 with all roles");
}

export function findUserByEmail(email: string) {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string) {
  return users.find((u) => u.id === id);
}

export async function createUser(email: string, password: string): Promise<AuthUser> {
  const existing = findUserByEmail(email);
  if (existing) throw new Error("User already exists");

  const passwordHash = await bcrypt.hash(password, 10);
  const id = (users.length + 1).toString();
  const user: AuthUser = {
    id,
    tenantId: "t1",
    memberId: `m-${id}`,
    email,
    passwordHash,
    status: "active",
    roles: ["member"],
    mfaEnabled: false,
  };
  users.push(user);
  return user;
}

export async function verifyPassword(user: AuthUser, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}

export function storeRefreshToken(token: string, userId: string) {
  refreshTokens.set(token, userId);
}

export function revokeRefreshToken(token: string) {
  refreshTokens.delete(token);
}

export function getUserIdForRefreshToken(token: string) {
  return refreshTokens.get(token);
}

export function revokeAllTokensForUser(userId: string) {
  for (const [token, uid] of refreshTokens.entries()) {
    if (uid === userId) refreshTokens.delete(token);
  }
}

