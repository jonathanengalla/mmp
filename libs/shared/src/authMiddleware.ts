import { Request, Response, NextFunction } from "express";

// Minimal auth middleware for scaffold: expects token format jwt-<tenantId>-<userId>
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "unauthorized", message: "Missing token", details: [] }, trace_id: "trace-" + Date.now() });
  }
  const token = header.replace("Bearer ", "");
  if (!token.startsWith("jwt-")) {
    return res.status(401).json({ error: { code: "unauthorized", message: "Invalid token", details: [] }, trace_id: "trace-" + Date.now() });
  }
  const parts = token.split("-");
  const tenantId = parts[1];
  const userId = parts[2];
  if (!tenantId || !userId) {
    return res.status(401).json({ error: { code: "unauthorized", message: "Invalid token", details: [] }, trace_id: "trace-" + Date.now() });
  }
  const rolesHeader = req.headers["x-roles"];
  const roles = typeof rolesHeader === "string" ? rolesHeader.split(",").map((r) => r.trim()).filter(Boolean) : [];
  (req as any).user = { tenantId, userId, memberId: `m-${userId}`, roles };
  req.headers["x-tenant-id"] = tenantId;
  next();
};

