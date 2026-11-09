import inquirer from 'inquirer';
import { encrypt, decrypt } from './crypto';

async function requestPassphrase(creating) {
  const { passphrase, confirmation } = await inquirer.prompt([
    {
      type: 'password', name: 'passphrase', mask: '*',
      message: creating ? 'Choose a credential passphrase (store it separately):' : 'Credential passphrase:',
      validate: (value) => value.length >= 12 || 'Use at least 12 characters.',
    },
    { type: 'password', name: 'confirmation', mask: '*', message: 'Confirm passphrase:', when: () => creating },
  ]);
  if (creating && passphrase !== confirmation) throw new Error('PASSPHRASE_CONFIRMATION_FAILED');
  return passphrase;
}

export async function encryptCredentials(credentials) {
  const passphrase = await requestPassphrase(true);
  const encrypted = {};
  Object.keys(credentials).forEach((field) => {
    encrypted[field] = encrypt(credentials[field], passphrase, field);
  });
  return encrypted;
}

export async function decryptCredentials(credentials) {
  if (Object.values(credentials).some((value) => typeof value !== 'string' || !value.startsWith('v1:'))) {
    throw new Error('LEGACY_CREDENTIALS_REENTER_REQUIRED');
  }
  const passphrase = await requestPassphrase(false);
  const decrypted = {};
  Object.keys(credentials).forEach((field) => {
    decrypted[field] = decrypt(credentials[field], passphrase, field);
  });
  return decrypted;
}
