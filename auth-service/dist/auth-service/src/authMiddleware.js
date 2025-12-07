"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const store_1 = require("./store");
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing Authorization header" });
    }
    const token = header.slice("Bearer ".length);
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.JWT_ACCESS_SECRET);
        const user = (0, store_1.findUserById)(payload.sub);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }
        req.user = user;
        return next();
    }
    catch (err) {
        console.error("[auth-middleware] Invalid access token", err);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
