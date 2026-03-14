import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { CalendarRangeQueryDto } from './dto/calendar-range-query.dto';
import { DayParamDto } from './dto/day-param.dto';
import { DayQueryDto } from './dto/day-query.dto';
import { CalendarService } from './calendar.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('calendar')
  getCalendarRange(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarRangeQueryDto,
  ): ReturnType<CalendarService['getCalendarRange']> {
    return this.calendarService.getCalendarRange(
      user.userId,
      query.from,
      query.to,
      query.tzOffsetMinutes ?? 0,
      query.timeZone,
    );
  }

  @Get('days/:date')
  getDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DayParamDto,
    @Query() query: DayQueryDto,
  ): ReturnType<CalendarService['getDayDetails']> {
    return this.calendarService.getDayDetails(
      user.userId,
      params.date,
      query.tzOffsetMinutes ?? 0,
      query.timeZone,
    );
  }
}
