import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a resolver or route out of authentication. Everything else requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
