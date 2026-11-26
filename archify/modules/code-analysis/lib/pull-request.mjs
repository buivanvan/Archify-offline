// A manually requested PR is a pair of pinned source trees. Repository code,
// package scripts and Git hooks are never run. The existing analyzer measures
// both sides; this module only prepares inputs and records their provenance.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { git, materializeTree, normalizeScope } from './git-sources.mjs';
export { materializeTree, normalizeScope } from './git-sources.mjs';
import { fail } from '../core/index.mjs';

const SHA = /^[a-f0-9]{40}$/;
async function checkoutContext(root) {
  const top = (await git(path.resolve(root), ['rev-parse', '--show-toplevel'])).toString('utf8').trim();
  // Git expands Windows 8.3 names; use the native realpath for both inputs so
  // a checkout reached through a short path still has the correct scope.
  const scope = normalizeScope(path.relative(fs.realpathSync.native(top), fs.realpathSync.native(root)).split(path.sep).join('/') || '.');
  return { root: top, scope };
}

export function resolvePullRequest() {
  fail('pr/offline', 'Use --base and --head with commits available locally.');
}

export async function resolveLocalPullRequest(root, base, head, scope) {
  for (const [side, commit] of Object.entries({ base, head })) {
    if (!SHA.test(commit)) fail('pr/commit-invalid', 'Use the full 40-character Git commit ID for each side.', {
      subject: { side }, supportedFixes: ['pass the full lowercase IDs from git rev-parse'],
    });
  }
  const context = await checkoutContext(root);
  return { root: context.root, scope: normalizeScope(scope ?? context.scope), local: { base, head } };
}

async function localFiles(root, base, head, scope) {
  const result = await git(root, ['diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none',
    '--no-relative', '--no-color', '--name-status', '-z', '-M50%', '-l1000', base, head, '--', ...(scope === '.' ? [] : [scope + '/'])]);
  if (!result.length) return [];
  const names = result.toString('utf8').split('\0');
  names.pop();
  const statuses = { A: 'added', D: 'removed', M: 'modified', T: 'modified', R: 'renamed' };
  const relative = name => scope === '.' ? name : name?.startsWith(scope + '/') ? name.slice(scope.length + 1) : null;
  const files = [];
  for (let i = 0; i < names.length;) {
    const status = statuses[names[i++][0]];
    const first = relative(names[i++]);
    const second = status === 'renamed' ? relative(names[i++]) : null;
    if (!status || !first || (status === 'renamed' && !second)) fail('pr/tree-invalid', 'Git returned an invalid changed-file record.');
    files.push({ path: second || first, previousPath: second ? first : null, status, additions: null, deletions: null });
  }
  return files;
}

async function prepareLocalPullRequest({ root, out, local, scope }) {
  const fixes = ['fetch the missing objects separately, then retry the same pinned comparison'];
  for (const [side, commit] of Object.entries(local)) {
    let type;
    try { type = (await git(root, ['cat-file', '-t', commit])).toString('ascii').trim(); }
    catch (error) {
      if (error.diagnostics?.[0]?.code !== 'pr/git-failed') throw error;
      fail('pr/local-object-missing', 'A pinned commit is unavailable in the local Git object database.', {
        subject: { side }, evidence: { commit }, supportedFixes: fixes,
      });
    }
    if (type !== 'commit') fail('pr/commit-invalid', 'A pinned object must be a commit.', { subject: { side }, evidence: { commit, type } });
  }
  const repository = path.basename(root);
  const pr = { repository, number: null, title: repository, url: null, local: true,
    baseSHA: local.base, mergeBaseSHA: local.base, headSHA: local.head, capturedAt: new Date().toISOString() };
  const directory = path.join(out, 'pull-requests', 'local', 'run-' + randomBytes(12).toString('hex'));
  const roots = { base: path.join(directory, 'base'), head: path.join(directory, 'head') };
  const manifests = {};
  try {
    for (const [side, sha] of Object.entries(local)) {
      try { manifests[side] = await materializeTree({ cache: root, sha, scope, target: roots[side] }); }
      catch (error) {
        const diagnostic = error.diagnostics?.[0];
        if (!diagnostic || !['pr/git-failed', 'pr/local-object-missing'].includes(diagnostic.code)) throw error;
        fail('pr/local-object-missing', 'The pinned source tree could not be read from the local Git object database.', {
          subject: { ...diagnostic.subject, side }, evidence: { ...diagnostic.evidence, commit: sha }, supportedFixes: fixes,
        });
      }
    }
    const changedFiles = await localFiles(root, local.base, local.head, scope);
    return { pr, scope, directory, roots, manifests, changedFiles, sourceGitRoot: root,
      source: side => ({ root: scope, revision: local[side], baseRevision: local.base, sourceKind: 'git-tree', url: null }) };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function preparePullRequest({ root, out, scope, local }) {
  if (!local) return resolvePullRequest();
  return prepareLocalPullRequest({ root, out, local, scope });
}
