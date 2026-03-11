import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import { Between, Repository } from 'typeorm';
import { MealEntryEntity, MealPhotoEntity } from '../database/entities';
import { AnalyzeMealDto } from './dto/analyze-meal.dto';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { AiAnalysisService } from './ai-analysis.service';
import { MealFilesService } from './meal-files.service';

export type MealResponse = {
  id: string;
  eatenAt: string;
  comment: string;
  dishName: string;
  dishDescription: string;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  confidence: number;
  aiModel: string | null;
  photoUrl: string;
  isUserEdited: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class MealsService {
  constructor(
    @InjectRepository(MealEntryEntity)
    private readonly mealEntriesRepository: Repository<MealEntryEntity>,
    @InjectRepository(MealPhotoEntity)
    private readonly mealPhotosRepository: Repository<MealPhotoEntity>,
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly mealFilesService: MealFilesService,
  ) {}

  async analyzeMeal(
    userId: string,
    dto: AnalyzeMealDto,
    photo: Express.Multer.File,
  ): Promise<{
    dishName: string;
    dishDescription: string;
    caloriesKcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    confidence: number;
    aiModel: string;
    needsUserConfirmation: boolean;
    photoPath: string;
    isStub: boolean;
    userId: string;
  }> {
    const storageKey = this.mealFilesService.toStorageKeyFromUploadedPath(
      photo.path,
    );
    const photoPath = this.mealFilesService.toPublicPath(storageKey);

    const aiResult = await this.aiAnalysisService.analyzeMeal({
      comment: dto.comment,
      photoPath,
      localFilePath: photo.path,
      photoMimeType: photo.mimetype,
    });

    return {
      dishName: aiResult.dishName,
      dishDescription: aiResult.dishDescription,
      caloriesKcal: aiResult.caloriesKcal,
      proteinG: aiResult.proteinG,
      fatG: aiResult.fatG,
      carbsG: aiResult.carbsG,
      confidence: aiResult.confidence,
      aiModel: aiResult.aiModel,
      needsUserConfirmation: aiResult.needsUserConfirmation,
      photoPath,
      isStub: aiResult.isStub,
      userId,
    };
  }

  async createMeal(userId: string, dto: CreateMealDto): Promise<MealResponse> {
    const storageKey = this.mealFilesService.toStorageKey(dto.photoPath);
    await this.mealFilesService.assertFileExists(storageKey);

    const mealEntry = this.mealEntriesRepository.create({
      userId,
      eatenAt: dto.eatenAt ? new Date(dto.eatenAt) : new Date(),
      comment: dto.comment?.trim() || null,
      dishName: dto.dishName.trim(),
      dishDescription: dto.dishDescription?.trim() || null,
      caloriesKcal: Math.round(dto.caloriesKcal),
      proteinG: dto.proteinG,
      fatG: dto.fatG,
      carbsG: dto.carbsG,
      aiConfidence: dto.confidence ?? 0,
      aiModel: dto.aiModel?.trim() || null,
      isUserEdited: dto.isUserEdited ?? false,
    });

    const savedMealEntry = await this.mealEntriesRepository.save(mealEntry);
    const sizeBytes = await this.readFileSize(storageKey);

    const photo = this.mealPhotosRepository.create({
      mealEntryId: savedMealEntry.id,
      storageKey,
      width: null,
      height: null,
      sizeBytes,
    });

    await this.mealPhotosRepository.save(photo);

    const withPhotos = await this.mealEntriesRepository.findOne({
      where: { id: savedMealEntry.id, userId },
      relations: { photos: true },
    });

    if (!withPhotos) {
      throw new NotFoundException('Meal was created, but cannot be loaded');
    }

    return this.toMealResponse(withPhotos);
  }

  async getMealById(userId: string, mealId: string): Promise<MealResponse> {
    const meal = await this.mealEntriesRepository.findOne({
      where: { id: mealId, userId },
      relations: { photos: true },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    return this.toMealResponse(meal);
  }

  async updateMeal(
    userId: string,
    mealId: string,
    patch: UpdateMealDto,
  ): Promise<MealResponse> {
    const meal = await this.mealEntriesRepository.findOne({
      where: { id: mealId, userId },
      relations: { photos: true },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    if (patch.eatenAt) {
      meal.eatenAt = new Date(patch.eatenAt);
    }

    if (typeof patch.comment === 'string') {
      meal.comment = patch.comment.trim() || null;
    }

    if (typeof patch.dishName === 'string') {
      meal.dishName = patch.dishName.trim();
    }

    if (typeof patch.dishDescription === 'string') {
      meal.dishDescription = patch.dishDescription.trim() || null;
    }

    if (typeof patch.caloriesKcal === 'number') {
      meal.caloriesKcal = Math.round(patch.caloriesKcal);
    }

    if (typeof patch.proteinG === 'number') {
      meal.proteinG = patch.proteinG;
    }

    if (typeof patch.fatG === 'number') {
      meal.fatG = patch.fatG;
    }

    if (typeof patch.carbsG === 'number') {
      meal.carbsG = patch.carbsG;
    }

    if (typeof patch.confidence === 'number') {
      meal.aiConfidence = patch.confidence;
    }

    if (typeof patch.aiModel === 'string') {
      meal.aiModel = patch.aiModel.trim() || null;
    }

    if (typeof patch.isUserEdited === 'boolean') {
      meal.isUserEdited = patch.isUserEdited;
    }

    if (typeof patch.photoPath === 'string') {
      const storageKey = this.mealFilesService.toStorageKey(patch.photoPath);
      await this.mealFilesService.assertFileExists(storageKey);

      if (meal.photos.length > 0) {
        await this.mealPhotosRepository.remove(meal.photos);
      }

      const sizeBytes = await this.readFileSize(storageKey);
      const newPhoto = this.mealPhotosRepository.create({
        mealEntryId: meal.id,
        storageKey,
        width: null,
        height: null,
        sizeBytes,
      });
      await this.mealPhotosRepository.save(newPhoto);
    }

    await this.mealEntriesRepository.save(meal);

    const updated = await this.mealEntriesRepository.findOne({
      where: { id: meal.id, userId },
      relations: { photos: true },
    });

    if (!updated) {
      throw new NotFoundException('Meal not found after update');
    }

    return this.toMealResponse(updated);
  }

  async deleteMeal(userId: string, mealId: string): Promise<void> {
    const meal = await this.mealEntriesRepository.findOneBy({
      id: mealId,
      userId,
    });
    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    await this.mealEntriesRepository.remove(meal);
  }

  async getMealsByDate(userId: string, date: string): Promise<MealResponse[]> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const meals = await this.mealEntriesRepository.find({
      where: {
        userId,
        eatenAt: Between(start, end),
      },
      relations: { photos: true },
      order: { eatenAt: 'DESC' },
    });

    return meals.map((meal) => this.toMealResponse(meal));
  }

  async getMealsInRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<MealEntryEntity[]> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    return this.mealEntriesRepository.find({
      where: {
        userId,
        eatenAt: Between(fromDate, toDate),
      },
      relations: { photos: true },
      order: { eatenAt: 'ASC' },
    });
  }

  private toMealResponse(meal: MealEntryEntity): MealResponse {
    const [firstPhoto] = meal.photos ?? [];

    return {
      id: meal.id,
      eatenAt: meal.eatenAt.toISOString(),
      comment: meal.comment ?? '',
      dishName: meal.dishName,
      dishDescription: meal.dishDescription ?? '',
      caloriesKcal: meal.caloriesKcal,
      proteinG: Number(meal.proteinG),
      fatG: Number(meal.fatG),
      carbsG: Number(meal.carbsG),
      confidence: Number(meal.aiConfidence),
      aiModel: meal.aiModel,
      photoUrl: firstPhoto
        ? this.mealFilesService.toPublicPath(firstPhoto.storageKey)
        : '/icons/meal-placeholder.svg',
      isUserEdited: meal.isUserEdited,
      createdAt: meal.createdAt.toISOString(),
      updatedAt: meal.updatedAt.toISOString(),
    };
  }

  private async readFileSize(storageKey: string): Promise<number> {
    const filePath = path.join(process.cwd(), 'uploads', storageKey);
    const fileStats = await stat(filePath);
    return fileStats.size;
  }
}
