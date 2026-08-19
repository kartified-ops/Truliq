const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'enc:v1:';

const getEncryptionKey = () => {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY or JWT_SECRET is required for credential encryption.');
  }
  return crypto.createHash('sha256').update(String(raw)).digest();
};

const isEncryptedValue = (value) => typeof value === 'string' && value.startsWith(PREFIX);

const encryptSecret = (plaintext) => {
  if (plaintext === undefined || plaintext === null || plaintext === '') return '';
  const text = String(plaintext);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptSecret = (value) => {
  if (!value) return '';
  if (!isEncryptedValue(value)) return String(value);
  const key = getEncryptionKey();
  const payload = value.slice(PREFIX.length);
  const [ivB64, authTagB64, dataB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Invalid encrypted credential format.');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
};

const maskSecret = (value, { visibleStart = 0, visibleEnd = 4 } = {}) => {
  if (!value) return '';
  const plain = isEncryptedValue(value) ? '********' : String(value);
  if (plain.length <= visibleEnd) return '••••••••';
  const tail = plain.slice(-visibleEnd);
  if (visibleStart > 0 && plain.length > visibleStart + visibleEnd) {
    return `${plain.slice(0, visibleStart)}${'*'.repeat(8)}${tail}`;
  }
  return `${'•'.repeat(Math.max(8, plain.length - visibleEnd))}${tail}`;
};

module.exports = {
  encryptSecret,
  decryptSecret,
  isEncryptedValue,
  maskSecret
};
