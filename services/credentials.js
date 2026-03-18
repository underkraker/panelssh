const crypto = require('crypto');
const config = require('../config');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
  const secret = String(config.CREDENTIALS_SECRET || 'lacasita-credentials-secret-change-me');
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plainText) {
  const text = String(plainText || '');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(payload) {
  if (!payload || typeof payload !== 'string') return '';
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) return '';

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}

module.exports = { encrypt, decrypt };
