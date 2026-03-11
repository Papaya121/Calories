import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { AuthService } from './auth.service';
import { BootstrapDto } from './dto/bootstrap.dto';
import { PasscodeLoginDto } from './dto/passcode-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { WebauthnOptionsDto } from './dto/webauthn-options.dto';
import { WebauthnVerifyDto } from './dto/webauthn-verify.dto';
import { REFRESH_COOKIE_NAME } from './auth.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('accounts')
  @HttpCode(HttpStatus.OK)
  async listAccounts(): Promise<{
    accounts: Array<{
      id: string;
      displayName: string | null;
      isActive: boolean;
    }>;
  }> {
    const accounts = await this.authService.listAccounts();
    return { accounts };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<{
    profile: {
      biologicalSex: 'male' | 'female' | null;
      weightKg: number | null;
      heightCm: number | null;
      ageYears: number | null;
      activityLevel:
        | 'sedentary'
        | 'light'
        | 'moderate'
        | 'active'
        | 'very_active'
        | null;
      goalType: 'lose' | 'maintain' | 'gain' | null;
      isComplete: boolean;
      kcalTargets: {
        lose: number;
        maintain: number;
        gain: number;
      } | null;
    };
  }> {
    const profile = await this.authService.getUserProfile(user.userId);
    return { profile };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<{
    profile: {
      biologicalSex: 'male' | 'female' | null;
      weightKg: number | null;
      heightCm: number | null;
      ageYears: number | null;
      activityLevel:
        | 'sedentary'
        | 'light'
        | 'moderate'
        | 'active'
        | 'very_active'
        | null;
      goalType: 'lose' | 'maintain' | 'gain' | null;
      isComplete: boolean;
      kcalTargets: {
        lose: number;
        maintain: number;
        gain: number;
      } | null;
    };
  }> {
    const profile = await this.authService.updateUserProfile(user.userId, dto);
    return { profile };
  }

  @Post('bootstrap')
  async bootstrap(
    @Body() dto: BootstrapDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    accessToken: string;
    accessExpiresInSec: number;
    user: {
      id: string;
      displayName: string | null;
      isActive: boolean;
    };
  }> {
    const session = await this.authService.bootstrap(dto);
    response.cookie(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      this.authService.getRefreshCookieConfig(),
    );

    return {
      accessToken: session.accessToken,
      accessExpiresInSec: session.accessExpiresInSec,
      user: session.user,
    };
  }

  @Post('passcode/login')
  @HttpCode(HttpStatus.OK)
  async loginWithPasscode(
    @Body() dto: PasscodeLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    accessToken: string;
    accessExpiresInSec: number;
    user: {
      id: string;
      displayName: string | null;
      isActive: boolean;
    };
  }> {
    const session = await this.authService.passcodeLogin(dto);

    response.cookie(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      this.authService.getRefreshCookieConfig(),
    );

    return {
      accessToken: session.accessToken,
      accessExpiresInSec: session.accessExpiresInSec,
      user: session.user,
    };
  }

  @Post('webauthn/options')
  @HttpCode(HttpStatus.OK)
  getWebauthnOptions(
    @Body() dto: WebauthnOptionsDto,
  ): ReturnType<AuthService['webauthnOptions']> {
    return this.authService.webauthnOptions(dto.usernameHint);
  }

  @Post('webauthn/verify')
  @HttpCode(HttpStatus.OK)
  async verifyWebauthn(
    @Body() dto: WebauthnVerifyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    accessToken: string;
    accessExpiresInSec: number;
    user: {
      id: string;
      displayName: string | null;
      isActive: boolean;
    };
    isStub: boolean;
  }> {
    const session = await this.authService.webauthnVerify(dto);

    response.cookie(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      this.authService.getRefreshCookieConfig(),
    );

    return {
      accessToken: session.accessToken,
      accessExpiresInSec: session.accessExpiresInSec,
      user: session.user,
      isStub: session.isStub,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    accessToken: string;
    accessExpiresInSec: number;
    user: {
      id: string;
      displayName: string | null;
      isActive: boolean;
    };
  }> {
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;
    const session = await this.authService.refreshSession(refreshToken ?? '');

    response.cookie(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      this.authService.getRefreshCookieConfig(),
    );

    return {
      accessToken: session.accessToken,
      accessExpiresInSec: session.accessExpiresInSec,
      user: session.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;
    await this.authService.logout(refreshToken);

    response.clearCookie(
      REFRESH_COOKIE_NAME,
      this.authService.getRefreshCookieConfig(),
    );

    return { success: true };
  }
}
