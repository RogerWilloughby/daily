// Version des Servers (gleicher Upload wie die App): Nummer aus package.json, Commit von Vercel.
const { version } = require('../../package.json');
const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null;
module.exports = { APP: { version, commit } };
