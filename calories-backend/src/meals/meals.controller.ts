import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { AnalyzeMealDto } from './dto/analyze-meal.dto';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { MealsService } from './meals.service';

const multerStorage = diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, path.join(process.cwd(), 'uploads', 'meals'));
  },
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

@Controller('meals')
@UseGuards(JwtAuthGuard)
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post('analyze')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: multerStorage,
      limits: {
        fileSize: 12 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(
            new BadRequestException('Only image uploads are supported'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  analyzeMeal(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() photo: Express.Multer.File,
    @Body() dto: AnalyzeMealDto,
  ): ReturnType<MealsService['analyzeMeal']> {
    if (!photo) {
      throw new BadRequestException('photo file is required');
    }

    return this.mealsService.analyzeMeal(user.userId, dto, photo);
  }

  @Post()
  createMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMealDto,
  ): ReturnType<MealsService['createMeal']> {
    return this.mealsService.createMeal(user.userId, dto);
  }

  @Get(':id')
  getMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') mealId: string,
  ): ReturnType<MealsService['getMealById']> {
    return this.mealsService.getMealById(user.userId, mealId);
  }

  @Patch(':id')
  updateMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') mealId: string,
    @Body() patch: UpdateMealDto,
  ): ReturnType<MealsService['updateMeal']> {
    return this.mealsService.updateMeal(user.userId, mealId, patch);
  }

  @Delete(':id')
  async deleteMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') mealId: string,
  ): Promise<{ success: true }> {
    await this.mealsService.deleteMeal(user.userId, mealId);
    return { success: true };
  }
}
