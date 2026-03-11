import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  AuthPasscodeEntity,
  SessionEntity,
  UserEntity,
} from '../database/entities';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserEntity, AuthPasscodeEntity, SessionEntity]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
