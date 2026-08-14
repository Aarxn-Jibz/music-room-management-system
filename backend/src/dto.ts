import { User } from './db/repositories/users.repository.js';

export type ApiRole = 'user' | 'admin';
export type DbRole = 'USER' | 'ADMIN';

export function mapRoleToApi(role: DbRole): ApiRole {
  return role === 'ADMIN' ? 'admin' : 'user';
}

export function mapRoleFromApi(role: ApiRole): DbRole {
  return role === 'admin' ? 'ADMIN' : 'USER';
}

export interface BandRef {
  id: string;
  name: string;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: ApiRole;
  bands: BandRef[];
}

export interface UserDTOWithPasswordFlag extends UserDTO {
  mustChangePassword: boolean;
}

export function toUserDTO(user: User, profiles: BandRef[]): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: mapRoleToApi(user.role),
    bands: profiles.map((p) => ({ id: p.id, name: p.name })),
  };
}

export function toUserDTOWithPasswordFlag(
  user: User,
  profiles: { id: string; name: string }[],
): UserDTOWithPasswordFlag {
  return {
    ...toUserDTO(user, profiles),
    mustChangePassword: user.mustChangePassword,
  };
}
