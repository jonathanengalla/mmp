"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const handlers_1 = require("./handlers");
const router = (0, express_1.Router)();
// Public
router.post("/login", handlers_1.login);
router.post("/refresh", handlers_1.refresh);
router.post("/password/reset/request", handlers_1.resetRequest);
router.post("/password/reset/confirm", handlers_1.resetConfirm);
// Protected (placeholder: auth middleware to be added)
router.post("/password/change", handlers_1.changePassword);
router.post("/users/:id/password/reset", handlers_1.adminReset);
router.post("/logout", handlers_1.logout);
router.get("/session", handlers_1.session);
// Health
router.get("/health", handlers_1.health);
router.get("/status", handlers_1.status);
exports.default = router;
