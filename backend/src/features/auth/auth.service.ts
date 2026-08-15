import { signToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { IAuthRepository } from './auth.repository.js';
import { RegisterInput, DEFAULT_USER_PASSWORD } from '../../schemas.js';
import { toUserDTOWithPasswordFlag, UserDTOWithPasswordFlag } from '../../dto.js';
import { User } from '../../db/repositories/users.repository.js';

export interface LoginResult {
  token: string;
  user: UserDTOWithPasswordFlag;
  expiresAtMs: number;
}

export class AuthService {
  constructor(private authRepo: IAuthRepository) {}

  async login(identifier: string, password: string, jwtSecret: string): Promise<LoginResult> {
    const user = await this.authRepo.findUserByEmail(identifier);
    if (!user) {
      // Fall back to username lookup for legacy users
      const byUsername = await this.authRepo.findUserByUsername(identifier);
      if (!byUsername) {
        throw new Error('UNAUTHORIZED');
      }
      return this.authenticate(byUsername, password, jwtSecret);
    }
    return this.authenticate(user, password, jwtSecret);
  }

  private async authenticate(user: User, password: string, jwtSecret: string): Promise<LoginResult> {
    if (!user.active) {
      throw new Error('UNAUTHORIZED');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('UNAUTHORIZED');
    }

    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const expiresAtMs = now + 24 * 60 * 60 * 1000; // 24 hours

    await this.authRepo.createSession({
      id: sessionId,
      userId: user.id,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: expiresAtMs,
      revoked: false,
    });

    const token = await signToken(
      {
        sessionId,
        userId: user.id,
        role: user.role,
      },
      jwtSecret,
      expiresAtMs,
    );

    const profiles = await this.authRepo.getProfilesForUser(user.id);

    return {
      token,
      expiresAtMs,
      user: toUserDTOWithPasswordFlag(user, profiles),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.authRepo.revokeSession(sessionId);
  }

  async getMe(userId: string): Promise<UserDTOWithPasswordFlag> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new Error('NOT_FOUND');
    }
    const profiles = await this.authRepo.getProfilesForUser(userId);
    return toUserDTOWithPasswordFlag(user, profiles);
  }

  async register(input: RegisterInput): Promise<UserDTOWithPasswordFlag> {
    const email = input.email.toLowerCase();
    const existing = await this.authRepo.findUserByEmail(email);
    if (existing) {
      throw new Error('DUPLICATE_EMAIL');
    }

    const now = Date.now();
    const password = input.password ?? DEFAULT_USER_PASSWORD;
    const passwordHash = await hashPassword(password);
    const user = await this.authRepo.createUser({
      id: crypto.randomUUID(),
      username: email,
      email,
      name: input.name,
      passwordHash,
      role: 'USER',
      mustChangePassword: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    if (input.bandIds && input.bandIds.length > 0) {
      await this.authRepo.linkProfiles(user.id, input.bandIds);
    }

    const profiles = await this.authRepo.getProfilesForUser(user.id);
    return toUserDTOWithPasswordFlag(user, profiles);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new Error('NOT_FOUND');
    }

    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new Error('UNAUTHORIZED');
    }

    const newHash = await hashPassword(newPassword);
    await this.authRepo.updatePassword(userId, newHash);
  }
}
