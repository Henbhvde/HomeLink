export type UserRole = 'unassigned' | 'super_admin' | 'manager' | 'accountant' | 'staff' | 'resident';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string;
  workspace?: Workspace;
  building?: string | null;
  apartment?: string | null;
  onboardingCompleted?: boolean;
};

export const managerRoles: UserRole[] = ['super_admin', 'manager', 'accountant', 'staff'];

export const isManagerRole = (role: UserRole) => managerRoles.includes(role);

export const demoRoleEmails: Record<UserRole, string> = {
  unassigned: 'unassigned@homelink.mn',
  super_admin: 'superadmin@homelink.mn',
  manager: 'manager@homelink.mn',
  accountant: 'nyarav@homelink.mn',
  staff: 'staff@homelink.mn',
  resident: 'resident@homelink.mn',
};

export const demoRoleNames: Record<UserRole, string> = {
  unassigned: 'Шинэ хэрэглэгч',
  super_admin: 'Ерөнхий админ',
  manager: 'Менежер',
  accountant: 'Нярав',
  staff: 'Ажилтан',
  resident: 'Оршин суугч',
};

export function getDemoRoleByEmail(email: string): UserRole | undefined {
  const normalized = email.trim().toLowerCase();
  return (Object.entries(demoRoleEmails) as [UserRole, string][])
    .find(([, roleEmail]) => roleEmail === normalized)?.[0];
}
