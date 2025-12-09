// Hash a password using the same helper as auth-service
const { hashPassword } = require("../dist/auth-service/src/utils/password.js");

async function main() {
  const password = "password123";
  const hash = await hashPassword(password);
  console.log("DEV HASH FOR password123:", hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

