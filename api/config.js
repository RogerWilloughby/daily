// DAILY – Betriebsart für die App: öffentlich (Standard) oder privat (Vercel-Variable DAILY_PRIVATE=1).
const { send, isPrivate } = require('./_lib/http');

module.exports = (req, res) => send(res, { private: isPrivate() }, 60);
