import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MealEntryEntity, MealPhotoEntity } from '../database/entities';
import { AiAnalysisService } from './ai-analysis.service';
import { MealFilesService } from './meal-files.service';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([MealEntryEntity, MealPhotoEntity]),
  ],
  controllers: [MealsController],
  providers: [MealsService, AiAnalysisService, MealFilesService, JwtAuthGuard],
  exports: [MealsService],
})
export class MealsModule {}
