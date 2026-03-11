import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { MealsModule } from '../meals/meals.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({}), MealsModule],
  controllers: [CalendarController],
  providers: [CalendarService, JwtAuthGuard],
})
export class CalendarModule {}
