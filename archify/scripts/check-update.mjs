#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { sameEntry } from '../renderers/shared/path-semantics.mjs';

export async function checkForUpdate() {
  return { status: 'silent', reason: 'disabled' };
}
export { checkForUpdate as readCachedUpdate, checkForUpdate as setUpdatePreference };

export function isMainModule({
  argvPath = process.argv[1],
  modulePath = fileURLToPath(import.meta.url),
} = {}) {
  if (!argvPath) return false;
  try {
    return sameEntry(argvPath, modulePath).status === 'match';
  } catch {
    return false;
  }
}

if (isMainModule()) console.log(JSON.stringify(await checkForUpdate()));
