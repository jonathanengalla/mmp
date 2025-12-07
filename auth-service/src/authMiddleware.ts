import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "./config";
import { findUserById } from "./store";

export type AuthRequest = Request & {
  user?:
    | {
        memberId?: string;
        tenantId?: string;
        roles?: string[];
        email?: string;
        [key: string]: any;
      }
    | null;
};

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as { sub: string };
    const user = findUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error("[auth-middleware] Invalid access token", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

