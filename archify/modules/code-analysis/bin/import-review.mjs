#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from '../core/index.mjs';

export const USAGE = 'Remote review collection is disabled in this offline build.';
export async function runImportReview() {
  fail('external/offline', USAGE);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error(USAGE);
  process.exitCode = 2;
}
