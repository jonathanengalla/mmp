import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  findUserByEmail,
  verifyPassword,
  storeRefreshToken,
  getUserIdForRefreshToken,
  revokeRefreshToken,
  findUserById,
} from "./store";
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "./config";

const errorResponse = (res: Response, code: string, message: string, status = 400) =>
  res.status(status).json({ error: { code, message, details: [] }, trace_id: "trace-" + Date.now() });

const signTokens = (userId: string, tenantId: string) => {
  const access_token = jwt.sign({ sub: userId, tenant_id: tenantId }, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
  const refresh_token = jwt.sign({ sub: userId, tenant_id: tenantId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  storeRefreshToken(refresh_token, userId);
  return { access_token, refresh_token };
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return errorResponse(res, "validation_failed", "Email and password are required", 400);

  const user = findUserByEmail(email);
  if (!user) return errorResponse(res, "invalid_credentials", "Invalid email or password", 401);
  if (user.status !== "active") return errorResponse(res, "inactive_user", "User not active/verified", 403);

  const ok = await verifyPassword(user, password);
  if (!ok) return errorResponse(res, "invalid_credentials", "Invalid email or password", 401);

  const { access_token, refresh_token } = signTokens(user.id, user.tenantId);
  const expires_in = 3600; // seconds
  return res.json({
    access_token,
    refresh_token,
    expires_in,
    member_id: user.memberId,
    tenant_id: user.tenantId,
    roles: user.roles,
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles,
    },
  });
};

export const refresh = (req: Request, res: Response) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return errorResponse(res, "validation_failed", "refresh_token required", 400);
  try {
    const decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET) as any;
    const userId = decoded.sub as string;
    const tokenUser = getUserIdForRefreshToken(refresh_token);
    if (!tokenUser || tokenUser !== userId) return errorResponse(res, "invalid_refresh", "Refresh token not recognized", 401);

    const user = findUserById(userId);
    if (!user) return errorResponse(res, "invalid_refresh", "User not found", 401);
    if (user.status !== "active") return errorResponse(res, "inactive_user", "User not active/verified", 403);

    // rotate
    revokeRefreshToken(refresh_token);
    const { access_token, refresh_token: newRefresh } = signTokens(user.id, user.tenantId);
    const expires_in = 3600;
    return res.json({ access_token, refresh_token: newRefresh, expires_in, member_id: user.memberId, tenant_id: user.tenantId });
  } catch (err) {
    return errorResponse(res, "invalid_refresh", "Invalid refresh token", 401);
  }
};

export const changePassword = (_req: Request, res: Response) => res.json({ status: "ok" });
export const resetRequest = (_req: Request, res: Response) => res.status(202).json({ status: "accepted" });
export const resetConfirm = (_req: Request, res: Response) => res.json({ status: "reset" });
export const adminReset = (_req: Request, res: Response) => res.status(202).json({ status: "sent" });
export const logout = (_req: Request, res: Response) => res.status(204).send();
export const session = (_req: Request, res: Response) =>
  res.json({ user_id: "u1", tenant_id: "t1", roles: ["admin"], expires_at: "2025-01-01T00:00:00Z", mfa_enabled: true });
export const health = (_req: Request, res: Response) => res.json({ status: "ok" });
export const status = (_req: Request, res: Response) => res.json({ status: "ok", deps: { db: "ok" } });

