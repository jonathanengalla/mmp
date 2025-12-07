"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.status = exports.health = exports.session = exports.logout = exports.adminReset = exports.resetConfirm = exports.resetRequest = exports.changePassword = exports.refresh = exports.login = void 0;
const store_1 = require("./store");
const errorResponse = (res, code, message, status = 400) => res.status(status).json({ error: { code, message, details: [] }, trace_id: "trace-" + Date.now() });
const login = (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
        return errorResponse(res, "validation_failed", "Email and password are required", 400);
    const user = (0, store_1.getUserByEmail)(email);
    if (!user || user.password !== password)
        return errorResponse(res, "invalid_credentials", "Invalid email or password", 401);
    if (user.status !== "active")
        return errorResponse(res, "inactive_user", "User not active/verified", 403);
    const access_token = `jwt-${user.tenantId}-${user.id}`;
    const refresh_token = `rjwt-${user.tenantId}-${user.id}`;
    return res.json({
        access_token,
        refresh_token,
        expires_in: 3600,
        member_id: user.memberId,
        tenant_id: user.tenantId,
    });
};
exports.login = login;
const refresh = (req, res) => {
    return res.json({ access_token: "jwt", refresh_token: "rjwt", expires_in: 3600 });
};
exports.refresh = refresh;
const changePassword = (req, res) => {
    return res.json({ status: "ok" });
};
exports.changePassword = changePassword;
const resetRequest = (req, res) => {
    return res.status(202).json({ status: "accepted" });
};
exports.resetRequest = resetRequest;
const resetConfirm = (req, res) => {
    return res.json({ status: "reset" });
};
exports.resetConfirm = resetConfirm;
const adminReset = (req, res) => {
    return res.status(202).json({ status: "sent" });
};
exports.adminReset = adminReset;
const logout = (req, res) => {
    return res.status(204).send();
};
exports.logout = logout;
const session = (req, res) => {
    return res.json({ user_id: "u1", tenant_id: "t1", roles: ["admin"], expires_at: "2025-01-01T00:00:00Z", mfa_enabled: true });
};
exports.session = session;
const health = (_req, res) => res.json({ status: "ok" });
exports.health = health;
const status = (_req, res) => res.json({ status: "ok", deps: { db: "ok" } });
exports.status = status;
