import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  AuthPasscodeEntity,
  SessionEntity,
  UserEntity,
} from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AuthPasscodeEntity, SessionEntity]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
