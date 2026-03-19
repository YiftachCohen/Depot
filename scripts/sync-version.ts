/**
 * Sync Version Script
 *
 * Reads the version from packages/shared/package.json (the source of truth)
 * and updates all package.json files in the monorepo to match.
 *
 * Usage: bun run scripts/sync-version.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const scriptDir = import.meta.dir;
const repoRoot = dirname(scriptDir);

// Read version from the source of truth: packages/shared/package.json
function getAppVersion(): string {
  const pkgFile = join(repoRoot, 'packages/shared/package.json');
  const content = readFileSync(pkgFile, 'utf-8');
  const pkg = JSON.parse(content);
  if (!pkg.version) {
    throw new Error('Could not find version in packages/shared/package.json');
  }
  return pkg.version;
}

// Update version in a package.json file
function updatePackageJson(filePath: string, version: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const pkg = JSON.parse(content);

  if (pkg.version === version) {
    return false; // Already up to date
  }

  pkg.version = version;
  writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  return true;
}

function main() {
  const version = getAppVersion();
  console.log(`Syncing version: ${version}`);
  console.log('');

  // Find all package.json files
  const packageFiles = [
    join(repoRoot, 'package.json'),
    ...readdirSync(join(repoRoot, 'apps')).map(dir => join(repoRoot, 'apps', dir, 'package.json')),
    ...readdirSync(join(repoRoot, 'packages')).map(dir => join(repoRoot, 'packages', dir, 'package.json')),
  ].filter(f => {
    try {
      readFileSync(f);
      return true;
    } catch {
      return false;
    }
  });

  let updated = 0;
  for (const file of packageFiles) {
    const relativePath = file.replace(repoRoot + '/', '');
    if (updatePackageJson(file, version)) {
      console.log(`  ✓ Updated ${relativePath}`);
      updated++;
    } else {
      console.log(`  - ${relativePath} (already ${version})`);
    }
  }

  console.log('');
  console.log(`Done. Updated ${updated} file(s).`);

  return version;
}

// Export for use in build.ts
export { getAppVersion };

// Run if executed directly
if (import.meta.main) {
  try {
    main();
  } catch (err: unknown) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}
