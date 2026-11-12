// Entry point for The Clothes Box Full-Stack Prototype.
// Checks the required environment variables first and stops with a clear message if any is missing.
const env = require('./backend/config/env');

try {
  env.assertValid();
} catch (err) {
  console.error(`[The Clothes Box] ${err.message}`);
  process.exit(1);
}

const { startServer } = require('./backend/server');

startServer(env.PORT);
