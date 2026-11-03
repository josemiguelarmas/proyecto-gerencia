// Entry point for The Clothes Box Full-Stack Prototype
const { startServer } = require('./backend/server');

const PORT = process.env.PORT || 3000;
startServer(PORT);
