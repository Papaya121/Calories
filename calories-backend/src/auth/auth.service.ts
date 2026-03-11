import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import {
  AuthPasscodeEntity,
  SessionEntity,
  UserEntity,
} from '../database/entities';
import { BootstrapDto } from './dto/bootstrap.dto';
import { PasscodeLoginDto } from './dto/passcode-login.dto';
import { WebauthnVerifyDto } from './dto/webauthn-verify.dto';

type TokenPayload = {
  sub: string;
  sid: string;
  type: 'access' | 'refresh';
};

type AuthSessionResult = {
  accessToken: string;
  accessExpiresInSec: number;
  refreshToken: string;
  user: {
    id: string;
    displayName: string | null;
    isActive: boolean;
  };
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(AuthPasscodeEntity)
    private readonly passcodesRepository: Repository<AuthPasscodeEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionsRepository: Repository<SessionEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async bootstrap(dto: BootstrapDto): Promise<AuthSessionResult> {
    const user = await this.findOrCreatePrimaryUser(dto.displayName);
    await this.upsertPasscode(user.id, dto.passcode);
    return this.createUserSession(user, dto.deviceName);
  }

  async passcodeLogin(dto: PasscodeLoginDto): Promise<AuthSessionResult> {
    const user = await this.usersRepository.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });

    if (!user) {
      throw new NotFoundException(
        'User is not initialized yet. Use /auth/bootstrap first',
      );
    }

    const passcode = await this.passcodesRepository.findOneBy({
      userId: user.id,
    });
    if (!passcode) {
      throw new UnauthorizedException('Passcode is not configured');
    }

    const isValid = await argon2.verify(
      passcode.passcodeHash,
      this.combinePasscode(dto.passcode, passcode.passcodeSalt),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid passcode');
    }

    return this.createUserSession(user, dto.deviceName);
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionResult> {
    const payload = this.verifyToken(refreshToken, 'refresh');

    const session = await this.sessionsRepository.findOne({
      where: { id: payload.sid, userId: payload.sub },
      relations: { user: true },
    });

    if (
      !session ||
      !session.user ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Refresh session is invalid');
    }

    const isTokenHashValid =
      session.refreshTokenHash === this.hashToken(refreshToken);
    if (!isTokenHashValid) {
      throw new UnauthorizedException('Refresh token was rotated or revoked');
    }

    return this.rotateSession(session);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = this.verifyToken(refreshToken, 'refresh');
      await this.sessionsRepository.update(
        { id: payload.sid, userId: payload.sub, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    } catch {
      // Invalid token during logout should not break logout flow.
    }
  }

  webauthnOptions(usernameHint?: string): {
    challenge: string;
    rpId: string;
    timeoutMs: number;
    usernameHint: string | null;
    isStub: boolean;
  } {
    return {
      challenge: randomBytes(32).toString('base64url'),
      rpId: this.configService.get<string>('WEBAUTHN_RP_ID') ?? 'localhost',
      timeoutMs: 60_000,
      usernameHint: usernameHint ?? null,
      isStub: true,
    };
  }

  async webauthnVerify(
    dto: WebauthnVerifyDto,
  ): Promise<AuthSessionResult & { isStub: boolean }> {
    const user = await this.usersRepository.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });

    if (!user) {
      throw new BadRequestException('No active user found for WebAuthn login');
    }

    if (!dto.assertionId.trim()) {
      throw new BadRequestException('assertionId is required');
    }

    const session = await this.createUserSession(user, dto.deviceName);
    return {
      ...session,
      isStub: true,
    };
  }

  getRefreshCookieConfig(): {
    maxAge: number;
    secure: boolean;
    sameSite: 'lax';
    httpOnly: boolean;
    path: string;
  } {
    const refreshDays = this.getRefreshTokenTtlDays();

    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<string>('COOKIE_SECURE') === 'true',
      path: '/api/v1/auth',
      maxAge: refreshDays * 24 * 60 * 60 * 1000,
    };
  }

  private async findOrCreatePrimaryUser(
    displayName?: string,
  ): Promise<UserEntity> {
    let user = await this.usersRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    if (!user) {
      user = this.usersRepository.create({
        displayName: displayName?.trim() || 'User',
        isActive: true,
      });
      return this.usersRepository.save(user);
    }

    if (!user.isActive) {
      user.isActive = true;
    }

    if (displayName?.trim()) {
      user.displayName = displayName.trim();
    }

    return this.usersRepository.save(user);
  }

  private async upsertPasscode(
    userId: string,
    passcode: string,
  ): Promise<void> {
    const salt = randomBytes(16).toString('base64url');
    const hash = await argon2.hash(this.combinePasscode(passcode, salt), {
      type: argon2.argon2id,
    });

    const existing = await this.passcodesRepository.findOneBy({ userId });
    if (!existing) {
      const passcodeEntity = this.passcodesRepository.create({
        userId,
        passcodeHash: hash,
        passcodeSalt: salt,
      });

      await this.passcodesRepository.save(passcodeEntity);
      return;
    }

    existing.passcodeHash = hash;
    existing.passcodeSalt = salt;
    await this.passcodesRepository.save(existing);
  }

  private combinePasscode(passcode: string, salt: string): string {
    const pepper =
      this.configService.get<string>('PASSCODE_PEPPER') ??
      'dev-passcode-pepper';
    return `${passcode}:${salt}:${pepper}`;
  }

  private async createUserSession(
    user: UserEntity,
    deviceName?: string,
  ): Promise<AuthSessionResult> {
    const expiresAt = new Date(
      Date.now() + this.getRefreshTokenTtlDays() * 24 * 60 * 60 * 1000,
    );

    let session = this.sessionsRepository.create({
      userId: user.id,
      deviceName: deviceName?.trim() || null,
      expiresAt,
      refreshTokenHash: '',
      revokedAt: null,
    });

    session = await this.sessionsRepository.save(session);

    const refreshToken = this.signToken(
      {
        sub: user.id,
        sid: session.id,
        type: 'refresh',
      },
      'refresh',
    );

    session.refreshTokenHash = this.hashToken(refreshToken);
    await this.sessionsRepository.save(session);

    const accessToken = this.signToken(
      {
        sub: user.id,
        sid: session.id,
        type: 'access',
      },
      'access',
    );

    return {
      accessToken,
      accessExpiresInSec: this.getAccessTokenTtlMinutes() * 60,
      refreshToken,
      user: {
        id: user.id,
        displayName: user.displayName,
        isActive: user.isActive,
      },
    };
  }

  private async rotateSession(
    session: SessionEntity,
  ): Promise<AuthSessionResult> {
    const refreshToken = this.signToken(
      {
        sub: session.userId,
        sid: session.id,
        type: 'refresh',
      },
      'refresh',
    );

    session.refreshTokenHash = this.hashToken(refreshToken);
    session.expiresAt = new Date(
      Date.now() + this.getRefreshTokenTtlDays() * 24 * 60 * 60 * 1000,
    );
    await this.sessionsRepository.save(session);

    const accessToken = this.signToken(
      {
        sub: session.userId,
        sid: session.id,
        type: 'access',
      },
      'access',
    );

    return {
      accessToken,
      accessExpiresInSec: this.getAccessTokenTtlMinutes() * 60,
      refreshToken,
      user: {
        id: session.user.id,
        displayName: session.user.displayName,
        isActive: session.user.isActive,
      },
    };
  }

  private signToken(
    payload: TokenPayload,
    tokenType: 'access' | 'refresh',
  ): string {
    const secret =
      tokenType === 'access'
        ? (this.configService.get<string>('JWT_ACCESS_SECRET') ??
          'dev-access-secret')
        : (this.configService.get<string>('JWT_REFRESH_SECRET') ??
          'dev-refresh-secret');

    const expiresIn =
      tokenType === 'access'
        ? this.getAccessTokenTtlMinutes() * 60
        : this.getRefreshTokenTtlDays() * 24 * 60 * 60;

    return this.jwtService.sign(payload, {
      secret,
      expiresIn,
    });
  }

  private verifyToken(
    token: string,
    expectedType: 'access' | 'refresh',
  ): TokenPayload {
    const secret =
      expectedType === 'access'
        ? (this.configService.get<string>('JWT_ACCESS_SECRET') ??
          'dev-access-secret')
        : (this.configService.get<string>('JWT_REFRESH_SECRET') ??
          'dev-refresh-secret');

    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== expectedType) {
      throw new UnauthorizedException('Invalid token type');
    }

    return payload;
  }

  private hashToken(token: string): string {
    const pepper =
      this.configService.get<string>('REFRESH_TOKEN_PEPPER') ??
      'dev-refresh-pepper';
    return createHash('sha256').update(`${token}:${pepper}`).digest('hex');
  }

  private getAccessTokenTtlMinutes(): number {
    const rawValue =
      this.configService.get<string>('JWT_ACCESS_TTL_MINUTES') ?? '15';
    return Number.parseInt(rawValue, 10) || 15;
  }

  private getRefreshTokenTtlDays(): number {
    const rawValue =
      this.configService.get<string>('JWT_REFRESH_TTL_DAYS') ?? '30';
    return Number.parseInt(rawValue, 10) || 30;
  }
}
