import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { config } from '../config';

/**
 * Private object storage. Keys are random UUIDs (sharded into folders), never derived from
 * file names or user input, and nothing in the storage directory is served directly: every
 * download goes through a route that checks permissions first.
 *
 * The local driver suits development and single-server deployments. An S3-compatible
 * driver can implement the same interface for multi-server hosting.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<{ stream: Readable; size: number }>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export function newStorageKey(prefix = 'f') {
  const id = randomUUID();
  return `${prefix}/${id.slice(0, 2)}/${id}`;
}

function resolveKey(key: string) {
  if (!/^[a-z]+\/[0-9a-f]{2}\/[0-9a-f-]{36}(\.[a-z]+)?$/.test(key)) throw new Error('Invalid storage key');
  const root = config.storageDir;
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
  return full;
}

export const localStorageDriver: StorageDriver = {
  async put(key, data) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: 'wx' });
  },
  async get(key) {
    const full = resolveKey(key);
    const s = await stat(full);
    return { stream: createReadStream(full), size: s.size };
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
  async exists(key) {
    try {
      await stat(resolveKey(key));
      return true;
    } catch {
      return false;
    }
  },
};

export const storage: StorageDriver = localStorageDriver;
