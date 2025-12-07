"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Simple in-memory dev user
const users = [
    {
        id: "1",
        email: "admin@test.local",
        password: "password123",
    },
];
router.post("/login", (req, res) => {
    try {
        console.log("[auth-service] POST /auth/login headers:", req.headers);
        console.log("[auth-service] POST /auth/login body:", req.body);
        const { email, password } = (req.body || {});
        if (!email || !password) {
            console.warn("[auth-service] Missing email or password", {
                email,
                passwordPresent: !!password,
            });
            return res
                .status(400)
                .json({ error: "Email and password are required" });
        }
        const user = users.find((u) => u.email === email);
        if (!user || user.password !== password) {
            console.warn("[auth-service] Invalid credentials for", email);
            return res.status(401).json({ error: "Invalid credentials" });
        }
        console.log("[auth-service] Login OK for", email);
        return res.json({
            success: true,
            token: "dev-token-123",
            user: {
                id: user.id,
                email: user.email,
            },
        });
    }
    catch (err) {
        console.error("[auth-service] Unexpected error in /auth/login:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
