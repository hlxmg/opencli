import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SRC_DIR, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

const SHIMS = [
  { file: 'registry-api.js', target: '../src/registry-api.ts' },
  { file: 'errors-api.js', target: '../src/errors-api.ts' },
  { file: 'browser-api.js', target: '../src/browser-api.ts' },
] as const;

async function writeShimIfNeeded(filePath: string, content: string): Promise<void> {
  try {
    const existing = await fs.promises.readFile(filePath, 'utf-8');
    if (existing === content) return;
  } catch {
    // Fall through to write missing shim
  }

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

/**
 * When running from src/ via tsx, package self-imports such as
 * '@jackwener/opencli/errors' resolve through package.json exports to dist/.
 * Ensure those dist entry points exist and proxy back to src/ so local dev and
 * manifest compilation can load plugin-style imports before a full tsc build.
 */
export async function ensureSelfImportShims(): Promise<void> {
  if (path.basename(SRC_DIR) !== 'src') return;
  await fs.promises.mkdir(DIST_DIR, { recursive: true });

  await Promise.all(
    SHIMS.map(({ file, target }) =>
      writeShimIfNeeded(
        path.join(DIST_DIR, file),
        `export * from '${target}';\n`,
      ),
    ),
  );
}
