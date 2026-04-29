import type { User } from '@blubranch/db';

/** Trim DB user to safe public payload (no password hash). */
export function serializeUser(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    authProvider: user.authProvider,
    profilePhotoUrl: user.profilePhotoUrl,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
