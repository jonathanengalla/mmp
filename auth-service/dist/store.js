"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = exports.setUsers = exports.resetStore = exports.getUserByEmail = void 0;
const baseUsers = [
    {
        id: "u-active",
        tenantId: "t1",
        memberId: "m-active",
        email: "active@example.com",
        password: "P@ssw0rd!",
        status: "active",
        roles: ["member"],
        mfaEnabled: false,
    },
    {
        id: "u-pending",
        tenantId: "t1",
        memberId: "m-pending",
        email: "pending@example.com",
        password: "P@ssw0rd!",
        status: "pending",
        roles: ["member"],
        mfaEnabled: false,
    },
];
// Dev-only seed user for local testing.
// TODO: Replace with proper DB seed or remove before production.
const devSeedUser = {
    id: "dev-1",
    tenantId: "t1",
    memberId: "m-dev",
    email: "admin@test.local",
    password: "password123",
    status: "active",
    roles: ["admin"],
    mfaEnabled: false,
};
let users = [...baseUsers];
if (process.env.NODE_ENV === "development") {
    const exists = users.find((u) => u.email.toLowerCase() === devSeedUser.email.toLowerCase());
    if (!exists) {
        users.push(devSeedUser);
    }
}
const getUserByEmail = (email) => users.find((u) => u.email.toLowerCase() === email.toLowerCase());
exports.getUserByEmail = getUserByEmail;
const resetStore = () => {
    users = [...baseUsers];
    if (process.env.NODE_ENV === "development") {
        const exists = users.find((u) => u.email.toLowerCase() === devSeedUser.email.toLowerCase());
        if (!exists)
            users.push(devSeedUser);
    }
};
exports.resetStore = resetStore;
const setUsers = (u) => {
    users = [...u];
};
exports.setUsers = setUsers;
const getUsers = () => users;
exports.getUsers = getUsers;
