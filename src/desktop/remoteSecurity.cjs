function normalizeRemoteAddress(address = '') {
  const value = String(address || '').trim().toLowerCase();
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function isPrivateLanAddress(address) {
  const ip = normalizeRemoteAddress(address);
  return ip === '127.0.0.1'
    || ip === '::1'
    || /^10\./.test(ip)
    || /^192\.168\./.test(ip)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
}

const crypto = require('crypto');

function tokensMatch(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);

  if (a.byteLength !== b.byteLength) return false;

  return crypto.timingSafeEqual(a, b);
}

function hasRemoteAccess(request, url, expectedToken) {
  if (!isPrivateLanAddress(request?.socket?.remoteAddress)) return false;
  const suppliedToken = String(
    request?.headers?.['x-remote-token']
      || request?.headers?.['x-nidalplayer-token']
      || url?.searchParams?.get('token')
      || ''
  );
  return Boolean(expectedToken) && tokensMatch(suppliedToken, String(expectedToken));
}

module.exports = { normalizeRemoteAddress, isPrivateLanAddress, hasRemoteAccess, tokensMatch };
