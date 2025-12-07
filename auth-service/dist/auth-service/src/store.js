"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDevUser = seedDevUser;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.createUser = createUser;
exports.verifyPassword = verifyPassword;
exports.storeRefreshToken = storeRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.getUserIdForRefreshToken = getUserIdForRefreshToken;
exports.revokeAllTokensForUser = revokeAllTokensForUser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const users = [];
const refreshTokens = new Map(); // token -> userId
// Dev-only seed user for local testing.
// TODO: Replace with proper DB seed or remove before production.
async function seedDevUser() {
    const existing = users.find((u) => u.email === "admin@test.local");
    if (existing)
        return;
    const passwordHash = await bcryptjs_1.default.hash("password123", 10);
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
function findUserByEmail(email) {
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}
function findUserById(id) {
    return users.find((u) => u.id === id);
}
async function createUser(email, password) {
    const existing = findUserByEmail(email);
    if (existing)
        throw new Error("User already exists");
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const id = (users.length + 1).toString();
    const user = {
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
async function verifyPassword(user, password) {
    return bcryptjs_1.default.compare(password, user.passwordHash);
}
function storeRefreshToken(token, userId) {
    refreshTokens.set(token, userId);
}
function revokeRefreshToken(token) {
    refreshTokens.delete(token);
}
function getUserIdForRefreshToken(token) {
    return refreshTokens.get(token);
}
function revokeAllTokensForUser(userId) {
    for (const [token, uid] of refreshTokens.entries()) {
        if (uid === userId)
            refreshTokens.delete(token);
    }
}
