"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlers_1 = require("../src/handlers");
const store_1 = require("../src/store");
const mockRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
    return res;
};
const makeReq = (body) => ({ body });
describe("auth login", () => {
    beforeEach(() => {
        (0, store_1.setUsers)([
            {
                id: "u1",
                tenantId: "t1",
                memberId: "m1",
                email: "active@example.com",
                password: "P@ssw0rd!",
                status: "active",
                roles: ["member"],
            },
            {
                id: "u2",
                tenantId: "t1",
                memberId: "m2",
                email: "pending@example.com",
                password: "P@ssw0rd!",
                status: "pending",
                roles: ["member"],
            },
        ]);
    });
    it("returns tokens for active user", () => {
        const req = makeReq({ email: "active@example.com", password: "P@ssw0rd!" });
        const res = mockRes();
        (0, handlers_1.login)(req, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.access_token).toBeDefined();
        expect(res.body.member_id).toBe("m1");
    });
    it("rejects invalid credentials", () => {
        const req = makeReq({ email: "active@example.com", password: "bad" });
        const res = mockRes();
        (0, handlers_1.login)(req, res);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBeDefined();
    });
    it("rejects inactive/pending users", () => {
        const req = makeReq({ email: "pending@example.com", password: "P@ssw0rd!" });
        const res = mockRes();
        (0, handlers_1.login)(req, res);
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBeDefined();
    });
});
