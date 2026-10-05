/** Role keys (mirrors public.roles) and the permission rules the UI needs. */

export const ROLE_KEYS = ["super_admin", "content_admin", "editor", "user"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const STAFF_ROLES = ["super_admin", "content_admin", "editor"] as const satisfies readonly RoleKey[];
export const PUBLISHER_ROLES = ["super_admin", "content_admin"] as const satisfies readonly RoleKey[];
export const USER_MANAGER_ROLES = ["super_admin"] as const satisfies readonly RoleKey[];

export function isRoleKey(value: unknown): value is RoleKey {
  return ROLE_KEYS.includes(value as RoleKey);
}

export function hasAnyRole(roles: readonly RoleKey[], allowed: readonly RoleKey[]): boolean {
  return roles.some((role) => allowed.includes(role));
}

export const isStaff = (roles: readonly RoleKey[]) => hasAnyRole(roles, STAFF_ROLES);
export const isPublisher = (roles: readonly RoleKey[]) => hasAnyRole(roles, PUBLISHER_ROLES);
export const canManageUsers = (roles: readonly RoleKey[]) => hasAnyRole(roles, USER_MANAGER_ROLES);
