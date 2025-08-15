import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
 // Should be 32 characters

export function encryptMessage(text: string): string {
  const secretKey = process.env.ENCRYPTION_KEY;
  

  if (!secretKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }

  if (secretKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters long.');
  }

  const iv = crypto.randomBytes(16); // 16 bytes for AES-256-CBC
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'utf-8'), iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}


export function decryptMessage(encryptedText: string): string {

  const secretKey = process.env.ENCRYPTION_KEY;

  if (!secretKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }

  if (secretKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters long.');
  }

  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'utf-8'), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}

