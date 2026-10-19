import { ConfigService } from '@nestjs/config';
import { isAbsolute, join, resolve } from 'node:path';
import type { Env } from '../config/env.js';

/** Absolute path of the reports folder. The API and the worker must point at the same one. */
export function reportsDir(config: ConfigService<Env, true>): string {
  const dir = config.get('REPORTS_DIR', { infer: true });
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}

/**
 * The database stores only the file name, not a full path, so the API and the worker can mount
 * the folder at different places (as they do in Docker).
 */
export function reportFileName(exportId: string): string {
  return `${exportId}.pdf`;
}

export function reportFilePath(dir: string, fileName: string): string {
  return join(dir, fileName);
}
