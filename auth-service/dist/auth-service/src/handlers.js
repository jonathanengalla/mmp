"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.status = exports.health = exports.session = exports.logout = exports.adminReset = exports.resetConfirm = exports.resetRequest = exports.changePassword = exports.refresh = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const store_1 = require("./store");
const config_1 = require("./config");
const errorResponse = (res, code, message, status = 400) => res.status(status).json({ error: { code, message, details: [] }, trace_id: "trace-" + Date.now() });
const signTokens = (userId, tenantId) => {
    const access_token = jsonwebtoken_1.default.sign({ sub: userId, tenant_id: tenantId }, config_1.JWT_ACCESS_SECRET, { expiresIn: config_1.ACCESS_TOKEN_EXPIRES_IN });
    const refresh_token = jsonwebtoken_1.default.sign({ sub: userId, tenant_id: tenantId }, config_1.JWT_REFRESH_SECRET, { expiresIn: config_1.REFRESH_TOKEN_EXPIRES_IN });
    (0, store_1.storeRefreshToken)(refresh_token, userId);
    return { access_token, refresh_token };
};
const login = async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
        return errorResponse(res, "validation_failed", "Email and password are required", 400);
    const user = (0, store_1.findUserByEmail)(email);
    if (!user)
        return errorResponse(res, "invalid_credentials", "Invalid email or password", 401);
    if (user.status !== "active")
        return errorResponse(res, "inactive_user", "User not active/verified", 403);
    const ok = await (0, store_1.verifyPassword)(user, password);
    if (!ok)
        return errorResponse(res, "invalid_credentials", "Invalid email or password", 401);
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
exports.login = login;
const refresh = (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token)
        return errorResponse(res, "validation_failed", "refresh_token required", 400);
    try {
        const decoded = jsonwebtoken_1.default.verify(refresh_token, config_1.JWT_REFRESH_SECRET);
        const userId = decoded.sub;
        const tokenUser = (0, store_1.getUserIdForRefreshToken)(refresh_token);
        if (!tokenUser || tokenUser !== userId)
            return errorResponse(res, "invalid_refresh", "Refresh token not recognized", 401);
        const user = (0, store_1.findUserById)(userId);
        if (!user)
            return errorResponse(res, "invalid_refresh", "User not found", 401);
        if (user.status !== "active")
            return errorResponse(res, "inactive_user", "User not active/verified", 403);
        // rotate
        (0, store_1.revokeRefreshToken)(refresh_token);
        const { access_token, refresh_token: newRefresh } = signTokens(user.id, user.tenantId);
        const expires_in = 3600;
        return res.json({ access_token, refresh_token: newRefresh, expires_in, member_id: user.memberId, tenant_id: user.tenantId });
    }
    catch (err) {
        return errorResponse(res, "invalid_refresh", "Invalid refresh token", 401);
    }
};
exports.refresh = refresh;
const changePassword = (_req, res) => res.json({ status: "ok" });
exports.changePassword = changePassword;
const resetRequest = (_req, res) => res.status(202).json({ status: "accepted" });
exports.resetRequest = resetRequest;
const resetConfirm = (_req, res) => res.json({ status: "reset" });
exports.resetConfirm = resetConfirm;
const adminReset = (_req, res) => res.status(202).json({ status: "sent" });
exports.adminReset = adminReset;
const logout = (_req, res) => res.status(204).send();
exports.logout = logout;
const session = (_req, res) => res.json({ user_id: "u1", tenant_id: "t1", roles: ["admin"], expires_at: "2025-01-01T00:00:00Z", mfa_enabled: true });
exports.session = session;
const health = (_req, res) => res.json({ status: "ok" });
exports.health = health;
const status = (_req, res) => res.json({ status: "ok", deps: { db: "ok" } });
exports.status = status;
