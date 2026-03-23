/**
 * Cross-platform asset copy script.
 *
 * Copies the resources/ directory to dist/resources/.
 * All bundled assets (docs, themes, permissions, tool-icons) now live in resources/
 * which electron-builder handles natively via directories.buildResources.
 *
 * At Electron startup, setBundledAssetsRoot(__dirname) is called, and then
 * getBundledAssetsDir('docs') resolves to <__dirname>/resources/docs/, etc.
 *
 * Run: bun scripts/copy-assets.ts
 */

import { cpSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Copy all resources (icons, themes, docs, permissions, tool-icons, etc.)
cpSync('resources', 'dist/resources', { recursive: true });

console.log('✓ Copied resources/ → dist/resources/');

// Copy PowerShell parser script (for Windows command validation in Explore mode)
// Source: packages/shared/src/agent/powershell-parser.ps1
// Destination: dist/resources/powershell-parser.ps1
const psParserSrc = join('..', '..', 'packages', 'shared', 'src', 'agent', 'powershell-parser.ps1');
const psParserDest = join('dist', 'resources', 'powershell-parser.ps1');
try {
  copyFileSync(psParserSrc, psParserDest);
  console.log('✓ Copied powershell-parser.ps1 → dist/resources/');
} catch (err) {
  // Only warn - PowerShell validation is optional on non-Windows platforms
  console.log('⚠ powershell-parser.ps1 copy skipped (not critical on non-Windows)');
}

// Copy sql-wasm.wasm binary for sql.js (Knowledge Store)
// In packaged builds, require.resolve('sql.js/package.json') fails because
// node_modules is excluded. sql.js falls back to loading sql-wasm.wasm from
// the same directory as the running script (dist/), so we place it there.
const sqlWasmSrc = join('..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const sqlWasmDest = join('dist', 'sql-wasm.wasm');
try {
  copyFileSync(sqlWasmSrc, sqlWasmDest);
  console.log('✓ Copied sql-wasm.wasm → dist/');
} catch (err) {
  console.warn('⚠ sql-wasm.wasm copy failed:', (err as Error).message);
}
