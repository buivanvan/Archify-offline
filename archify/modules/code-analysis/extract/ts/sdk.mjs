import bundledTs from '../../vendor/typescript.cjs';
import { fail } from '../shared/diagnostics.mjs';

const bundled = { ts: bundledTs, packagePath: null, version: bundledTs.version,
  source: 'bundled', status: 'fallback', limitations: [] };

export function selectTypeScripts(root, snapshot, config, selected, { capturedOnly }) {
  const sourceFiles = snapshot.names.filter(selected);
  // Pinned-tree analysis must not load an SDK from the live filesystem.
  if (capturedOnly) return [{ sdk: bundled, files: sourceFiles }];

  const settings = config.typescript === undefined ? {} : config.typescript;
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)
    || (settings.sdk !== undefined && typeof settings.sdk !== 'string')
    || (settings.requireProjectSdk !== undefined && typeof settings.requireProjectSdk !== 'boolean')) {
    fail('extract/typescript-settings-invalid', 'The TypeScript SDK settings are invalid.', {
      subject: { option: 'typescript' }, supportedFixes: ['set typescript.sdk to "bundled" and requireProjectSdk to a boolean'],
    });
  }
  if ((settings.sdk ?? 'bundled') !== 'bundled' || settings.requireProjectSdk) {
    fail('extract/typescript-sdk-required', 'Offline analysis requires the bundled TypeScript SDK.');
  }
  return [{ sdk: bundled, files: sourceFiles }];
}
