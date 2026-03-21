/**
 * CI helper: download vendor binaries (Bun, uv) into apps/electron/vendor/
 * before electron-builder packages the app.
 *
 * Usage: bun run scripts/ci-prepare-vendor.ts --platform <darwin|win32|linux> --arch <arm64|x64>
 */

import { parseArgs } from 'node:util';
import { join } from 'node:path';
import {
  downloadBun,
  downloadUv,
  copySDK,
  verifySDKCopy,
  copyInterceptor,
  copyInterceptorBundle,
  buildMcpServers,
  copySessionServer,
  copyPiAgentServer,
  type Platform,
  type Arch,
  type BuildConfig,
} from './build/common.ts';

const { values } = parseArgs({
  options: {
    platform: { type: 'string' },
    arch: { type: 'string', default: 'x64' },
  },
  strict: true,
});

const platform = (values.platform ?? process.platform) as Platform;
const arch = (values.arch ?? process.arch) as Arch;

if (!['darwin', 'win32', 'linux'].includes(platform)) {
  throw new Error(`Unsupported platform: ${platform}`);
}
if (!['x64', 'arm64'].includes(arch)) {
  throw new Error(`Unsupported arch: ${arch}`);
}

const rootDir = join(import.meta.dir, '..');
const electronDir = join(rootDir, 'apps', 'electron');

const config: BuildConfig = {
  platform,
  arch,
  upload: false,
  uploadLatest: false,
  uploadScript: false,
  rootDir,
  electronDir,
};

console.log(`=== Preparing vendor binaries for ${platform}-${arch} ===\n`);

// Download Bun runtime
console.log('[1/6] Downloading Bun...');
await downloadBun(config);

// Download uv
console.log('\n[2/6] Downloading uv...');
await downloadUv(config);

// Copy SDK (real files, not symlinks)
console.log('\n[3/6] Copying SDK...');
copySDK(config);
verifySDKCopy(config);

// Copy interceptor source files
console.log('\n[4/6] Copying interceptor...');
copyInterceptor(config);
copyInterceptorBundle(config);

// Build MCP servers
console.log('\n[5/6] Building MCP servers...');
buildMcpServers(config);

// Copy MCP servers to resources
console.log('\n[6/6] Copying MCP servers...');
copySessionServer(config);
copyPiAgentServer(config);

console.log('\n=== Vendor preparation complete ===');
