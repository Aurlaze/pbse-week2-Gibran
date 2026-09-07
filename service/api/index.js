// Vercel entry point. Exports the app instead of calling listen(), because a
// serverless function is invoked per request rather than run as a server.
// src/server.js still starts a normal process for local development.
module.exports = require("../src/app");
