// Every migration, in order. Add new ones here after generating them. Listed explicitly
// because loading .ts migrations through a glob fails under ESM.
import { Init1792275697516 } from './1792275697516-Init.js';

export const migrations = [Init1792275697516];
