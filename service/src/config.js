// service/src/config.js
require('dotenv').config(); // Ensure variables are loaded

const required = ['DATABASE_URL', 'OIDC_ISSUER', 'OIDC_JWKS_URI', 'OIDC_AUDIENCE'];
const missing = required.filter((k) => !process.env[k]);

if (missing.length) {
    throw new Error(`Required configuration missing: ${missing.join(', ')}`);
}

module.exports = {
    oidcIssuer: process.env.OIDC_ISSUER,
    oidcJwksUri: process.env.OIDC_JWKS_URI,
    oidcAudience: process.env.OIDC_AUDIENCE
};
