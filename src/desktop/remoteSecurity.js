const crypto = require('crypto');

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

function hasRemoteAccess(request, url, expectedToken) {
  if (!isPrivateLanAddress(request?.socket?.remoteAddress)) return false;
  const suppliedToken = String(
    request?.headers?.['x-remote-token']
      || request?.headers?.['x-nidalplayer-token']
      || url?.searchParams?.get('token')
      || ''
  );

  if (!expectedToken) return false;

  const suppliedBuf = Buffer.from(suppliedToken);
  const expectedBuf = Buffer.from(expectedToken);

  // Use byteLength instead of string length to prevent TypeError with multi-byte characters
  if (suppliedBuf.byteLength !== expectedBuf.byteLength) {
    return false;
  }

  return crypto.timingSafeEqual(suppliedBuf, expectedBuf);
}

module.exports = { normalizeRemoteAddress, isPrivateLanAddress, hasRemoteAccess };
