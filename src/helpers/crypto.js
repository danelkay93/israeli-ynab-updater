import crypto from 'crypto';

// The passphrase is supplied by the caller, never bundled or stored with ciphertext.
export function encrypt(text, passphrase, field) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(['ynab-credentials-v1', field])));
    const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    return ['v1', salt.toString('hex'), iv.toString('hex'),
      cipher.getAuthTag().toString('hex'), data.toString('hex')].join(':');
  } finally {
    key.fill(0);
  }
}

export function decrypt(text, passphrase, field) {
  if (typeof text !== 'string' || !text.startsWith('v1:')) {
    throw new Error('LEGACY_CREDENTIALS_REENTER_REQUIRED');
  }
  try {
    const parts = text.split(':');
    if (parts.length !== 5 || !/^[a-f0-9]{32}$/.test(parts[1])
      || !/^[a-f0-9]{24}$/.test(parts[2]) || !/^[a-f0-9]{32}$/.test(parts[3])
      || !/^(?:[a-f0-9]{2})*$/.test(parts[4])) throw new Error('INVALID_ENVELOPE');
    const [, salt, iv, tag, data] = parts;
    const key = crypto.scryptSync(passphrase, Buffer.from(salt, 'hex'), 32);
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAAD(Buffer.from(JSON.stringify(['ynab-credentials-v1', field])));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
    } finally {
      key.fill(0);
    }
  } catch (_) {
    throw new Error('CREDENTIAL_DECRYPTION_FAILED');
  }
}
