import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Modes protect new files on POSIX. Windows requires a private directory ACL.
async function verifyFolder(folderPath) {
  await fs.promises.mkdir(folderPath, { recursive: true, mode: 0o700 });
}

export async function getFolderFiles(folderPath, suffix) {
  await verifyFolder(folderPath);
  const files = await fs.promises.readdir(folderPath, { withFileTypes: true });
  return files.filter((file) => file.isFile()
    && (!suffix || path.extname(file.name).toLowerCase() === suffix.toLowerCase()))
    .map((file) => file.name);
}

export async function deleteFile(filePath) {
  return fs.promises.unlink(filePath);
}

export async function writeFile(filePath, data) {
  await verifyFolder(path.dirname(filePath));
  // Exclusive temporary file + rename avoids partial writes and symlink following.
  const temporary = filePath + '.' + crypto.randomBytes(16).toString('hex') + '.tmp';
  try {
    await fs.promises.writeFile(temporary, data, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await fs.promises.rename(temporary, filePath);
  } finally {
    await fs.promises.unlink(temporary).catch(() => {});
  }
}

export async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('CONFIG_READ_FAILED');
  }
}

export async function writeJsonFile(filePath, obj) {
  return writeFile(filePath, JSON.stringify(obj, null, 2));
}
