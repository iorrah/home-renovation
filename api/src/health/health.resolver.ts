import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/decorators/public.decorator.js';

/** Lets load balancers and smoke tests check the API is up. Open to everyone. */
@Public()
@Resolver()
export class HealthResolver {
  @Query(() => String)
  health(): string {
    return 'ok';
  }
}
