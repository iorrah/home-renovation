export type UserRole = 'CONTRACTOR' | 'HOMEOWNER';

export type User = {
  id: string;
  username: string;
  role: UserRole;
};
