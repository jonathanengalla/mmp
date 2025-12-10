import jwt, { Algorithm } from "jsonwebtoken";

export type JwtPayload = {
  userId: string;
  tenantId: string;
  roles: string[];
  platformRoles?: string[];
  exp?: number;
};

const DEFAULT_ALG: Algorithm = (process.env.JWT_ALGORITHM as Algorithm) || "HS256";
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "dev-jwt-secret-change-me";
const DEFAULT_EXPIRY_SECONDS = parseInt(process.env.JWT_EXPIRES_IN_SECONDS || "3600", 10);

export function signToken(payload: JwtPayload): string {
  const exp = payload.exp ?? Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;
  return jwt.sign(
    {
      userId: payload.userId,
      tenantId: payload.tenantId,
      roles: payload.roles,
      platformRoles: payload.platformRoles ?? [],
      exp,
    },
    JWT_SECRET,
    { algorithm: DEFAULT_ALG }
  );
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [DEFAULT_ALG] }) as JwtPayload;
  return decoded;
}

