/** For class-transformer's @Transform: trims strings so "   " fails @IsNotEmpty. */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
