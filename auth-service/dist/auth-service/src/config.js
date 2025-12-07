"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TOKEN_EXPIRES_IN = exports.ACCESS_TOKEN_EXPIRES_IN = exports.JWT_REFRESH_SECRET = exports.JWT_ACCESS_SECRET = void 0;
exports.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me";
exports.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me";
exports.ACCESS_TOKEN_EXPIRES_IN = "15m";
exports.REFRESH_TOKEN_EXPIRES_IN = "7d";
