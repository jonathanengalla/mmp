import type { Request, Response } from "express";

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  meta?: Record<string, unknown>;
  template?: string;
  payload?: unknown;
}

interface EmailLogEntry extends EmailPayload {
  id: string;
  createdAt: string;
}

const emailLog: EmailLogEntry[] = [];

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const entry: EmailLogEntry = {
    id: `mail_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    payload: payload.payload ?? payload.meta ?? null,
    ...payload,
  };
  emailLog.unshift(entry);
  if (emailLog.length > 200) emailLog.length = 200;
  // eslint-disable-next-line no-console
  console.log("[email] sendEmail", { to: payload.to, subject: payload.subject, meta: payload.meta });
}

export function getEmailLog(limit = 50): EmailLogEntry[] {
  return emailLog.slice(0, limit);
}

export function emailLogHandler(req: Request, res: Response) {
  const limitParam = req.query.limit;
  const limit = typeof limitParam === "string" ? parseInt(limitParam, 10) || 50 : 50;
  return res.json({ items: getEmailLog(limit) });
}


