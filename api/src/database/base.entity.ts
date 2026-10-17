import { CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Columns every table shares. Named AppBaseEntity so it is not confused with TypeORM's own
 * BaseEntity, which adds Active Record methods (user.save()) that this codebase does not use.
 */
export abstract class AppBaseEntity {
  // Postgres 18 generates time-ordered UUIDs (v7), so new rows append to the end of the index.
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** For tables whose rows change after insert. Append-only tables (messages, history) skip it. */
export abstract class AppUpdatableEntity extends AppBaseEntity {
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
