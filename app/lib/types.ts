export type UserRole = 'CONTRACTOR' | 'HOMEOWNER';

export type User = {
  id: string;
  username: string;
  role: UserRole;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  CONTRACTOR: 'Contractor',
  HOMEOWNER: 'Homeowner',
};
