import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_AI_MICROSERVICE_URL = 'http://150.241.91.222:3666/';
const DEFAULT_ANALYZE_TIMEOUT_MS = 20_000;
const DEFAULT_TEMPERATURE = 0.2;

type AnalyzeInput = {
  comment?: string;
  photoPath: string;
  localFilePath?: string;
  photoMimeType?: string;
};

export type AnalyzeOutput = {
  dishName: string;
  dishDescription: string;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  estimatedWeightG: number;
  confidence: number;
  aiModel: string;
  needsUserConfirmation: boolean;
  isStub: boolean;
};

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(private readonly configService: ConfigService) {}

  async analyzeMeal(input: AnalyzeInput): Promise<AnalyzeOutput> {
    const microserviceUrl = this.resolveMicroserviceUrl();

    if (!microserviceUrl) {
      return this.buildStubResult(input, 'stub/offline');
    }

    try {
      const primaryRequest = this.buildProxyRequest(input, true);
      let response = await this.callMicroservice(
        microserviceUrl,
        primaryRequest,
      );

      if (!response.ok && response.status >= 500) {
        const imageUrl = this.extractImageUrlFromRequest(primaryRequest);
        const responseBody = await this.readResponseBody(response);
        this.logger.warn(
          `AI microservice returned status ${response.status}. image_url=${imageUrl ?? 'none'}. body=${responseBody || '<empty>'}`,
        );

        if (imageUrl) {
          this.logger.warn(
            'Retrying AI request without image_url because primary request failed with 5xx',
          );
          const fallbackRequest = this.buildProxyRequest(input, false);
          response = await this.callMicroservice(
            microserviceUrl,
            fallbackRequest,
          );
        }
      }

      if (!response.ok) {
        const responseBody = await this.readResponseBody(response);
        this.logger.warn(
          `AI microservice returned status ${response.status}. body=${responseBody || '<empty>'}`,
        );
        return this.buildStubResult(input, 'stub/fallback');
      }

      const payload = this.toRecord(await response.json());
      if (!payload) {
        this.logger.warn('AI microservice returned unexpected JSON payload');
        return this.buildStubResult(input, 'stub/parse-fallback');
      }

      const normalized = this.normalizePayload(payload, input);
      if (!normalized) {
        this.logger.warn('AI microservice payload cannot be parsed');
        return this.buildStubResult(input, 'stub/parse-fallback');
      }

      return normalized;
    } catch (error) {
      this.logger.warn(
        `AI microservice is unavailable, fallback enabled: ${String(error)}`,
      );
      return this.buildStubResult(input, 'stub/fallback');
    }
  }

  private normalizePayload(
    payload: Record<string, unknown>,
    input: AnalyzeInput,
  ): AnalyzeOutput | undefined {
    const aiPayload = this.extractAiPayload(payload);
    const responsePayload = this.toRecord(payload.response);
    if (!aiPayload) {
      return undefined;
    }

    const dishName =
      this.pickString(aiPayload, ['dishName', 'dish_name']) ??
      'Неопознанное блюдо';
    const dishDescription =
      this.pickString(aiPayload, ['dishDescription', 'dish_description']) ??
      this.descriptionFromComment(input.comment);
    const rawCaloriesKcal =
      this.pickNumber(aiPayload, ['caloriesKcal', 'calories_kcal']) ?? 600;
    const rawProteinG = this.pickNumber(aiPayload, ['proteinG', 'protein_g']) ?? 28;
    const rawFatG = this.pickNumber(aiPayload, ['fatG', 'fat_g']) ?? 22;
    const rawCarbsG = this.pickNumber(aiPayload, ['carbsG', 'carbs_g']) ?? 68;
    const parsedWeightG = this.pickNumber(aiPayload, [
      'estimatedWeightG',
      'estimated_weight_g',
      'portionWeightG',
      'portion_weight_g',
      'weightG',
      'weight_g',
      'grams',
    ]);
    const aiWeightG =
      typeof parsedWeightG === 'number'
        ? this.normalizeWeightG(parsedWeightG)
        : undefined;
    const userProvidedWeightG = this.extractWeightFromText(input.comment);
    const textualWeightG =
      userProvidedWeightG ??
      this.extractWeightFromText(`${dishName} ${dishDescription}`);
    const estimatedWeightG =
      textualWeightG ??
      aiWeightG ??
      this.estimateWeightFromCalories(rawCaloriesKcal);

    const nutritionPer100gPayload = this.extractNutritionPer100gPayload(aiPayload);
    const caloriesPer100gKcal = this.normalizeCaloriesPer100gKcal(
      this.pickNumber(aiPayload, [
        'caloriesPer100gKcal',
        'calories_per_100g_kcal',
        'kcalPer100g',
        'kcal_per_100g',
      ]) ??
        (nutritionPer100gPayload
          ? this.pickNumber(nutritionPer100gPayload, [
              'caloriesKcal',
              'calories_kcal',
              'kcal',
            ])
          : undefined) ??
        this.derivePer100(rawCaloriesKcal, aiWeightG ?? estimatedWeightG),
    );
    const proteinPer100g = this.normalizeMacroPer100g(
      this.pickNumber(aiPayload, ['proteinPer100g', 'protein_per_100g']) ??
        (nutritionPer100gPayload
          ? this.pickNumber(nutritionPer100gPayload, ['proteinG', 'protein_g'])
          : undefined) ??
        this.derivePer100(rawProteinG, aiWeightG ?? estimatedWeightG),
    );
    const fatPer100g = this.normalizeMacroPer100g(
      this.pickNumber(aiPayload, ['fatPer100g', 'fat_per_100g']) ??
        (nutritionPer100gPayload
          ? this.pickNumber(nutritionPer100gPayload, ['fatG', 'fat_g'])
          : undefined) ??
        this.derivePer100(rawFatG, aiWeightG ?? estimatedWeightG),
    );
    const carbsPer100g = this.normalizeMacroPer100g(
      this.pickNumber(aiPayload, ['carbsPer100g', 'carbs_per_100g']) ??
        (nutritionPer100gPayload
          ? this.pickNumber(nutritionPer100gPayload, ['carbsG', 'carbs_g'])
          : undefined) ??
        this.derivePer100(rawCarbsG, aiWeightG ?? estimatedWeightG),
    );

    const caloriesKcal = Math.round(
      this.scaleFromPer100(caloriesPer100gKcal, estimatedWeightG),
    );
    const proteinG = this.roundToOne(
      this.scaleFromPer100(proteinPer100g, estimatedWeightG),
    );
    const fatG = this.roundToOne(this.scaleFromPer100(fatPer100g, estimatedWeightG));
    const carbsG = this.roundToOne(
      this.scaleFromPer100(carbsPer100g, estimatedWeightG),
    );
    const macroBasedCaloriesKcal = this.roundToOne(
      proteinG * 4 + fatG * 9 + carbsG * 4,
    );
    const normalizedCaloriesKcal = this.reconcileCaloriesKcal(
      caloriesKcal,
      macroBasedCaloriesKcal,
    );

    return {
      dishName,
      dishDescription,
      caloriesKcal: normalizedCaloriesKcal,
      proteinG,
      fatG,
      carbsG,
      estimatedWeightG,
      confidence: this.clamp01(
        this.pickNumber(aiPayload, ['confidence']) ?? 0.68,
      ),
      aiModel:
        this.pickString(aiPayload, ['aiModel', 'ai_model']) ??
        this.pickString(payload, ['model']) ??
        (responsePayload
          ? this.pickString(responsePayload, ['model'])
          : undefined) ??
        'microservice/unknown',
      needsUserConfirmation:
        this.pickBoolean(aiPayload, [
          'needsUserConfirmation',
          'needs_user_confirmation',
        ]) ?? true,
      isStub: false,
    };
  }

  private extractNutritionPer100gPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    return (
      this.toRecord(payload.nutritionPer100g) ??
      this.toRecord(payload.nutrition_per_100g) ??
      this.toRecord(payload.per100g)
    );
  }

  private derivePer100(
    totalValue: number,
    weightG: number,
  ): number | undefined {
    if (weightG <= 0) {
      return undefined;
    }

    return (totalValue * 100) / weightG;
  }

  private scaleFromPer100(per100Value: number, weightG: number): number {
    if (weightG <= 0) {
      return 0;
    }

    return (per100Value * weightG) / 100;
  }

  private normalizeCaloriesPer100gKcal(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 170;
    }

    return Math.round(this.clampRange(value, 20, 900));
  }

  private normalizeMacroPer100g(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }

    return this.roundToOne(this.clampRange(value, 0, 100));
  }

  private reconcileCaloriesKcal(
    caloriesKcal: number,
    macroBasedCaloriesKcal: number,
  ): number {
    if (!Number.isFinite(macroBasedCaloriesKcal) || macroBasedCaloriesKcal <= 0) {
      return caloriesKcal;
    }

    const relativeDelta =
      Math.abs(caloriesKcal - macroBasedCaloriesKcal) / macroBasedCaloriesKcal;
    if (relativeDelta <= 0.35) {
      return caloriesKcal;
    }

    return Math.round((caloriesKcal + macroBasedCaloriesKcal) / 2);
  }

  private extractWeightFromText(text?: string): number | undefined {
    if (!text?.trim()) {
      return undefined;
    }

    const matches = text.matchAll(
      /(\d+(?:[.,]\d+)?)\s*(кг|kg|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|g)\b/giu,
    );
    let parsedWeightG: number | undefined;
    for (const match of matches) {
      const rawValue = match[1]?.replace(',', '.');
      const unit = match[2]?.toLowerCase();
      if (!rawValue || !unit) {
        continue;
      }

      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        continue;
      }

      if (unit === 'kg' || unit.startsWith('кг') || unit.startsWith('килограмм')) {
        parsedWeightG = numericValue * 1000;
        continue;
      }

      parsedWeightG = numericValue;
    }

    if (typeof parsedWeightG !== 'number' || !Number.isFinite(parsedWeightG)) {
      return undefined;
    }

    return this.normalizeWeightG(parsedWeightG);
  }

  private buildStubResult(input: AnalyzeInput, aiModel: string): AnalyzeOutput {
    const commentLength = input.comment?.trim().length ?? 0;
    const calories = 460 + Math.min(280, commentLength * 4);
    const protein = Math.round((20 + commentLength * 0.25) * 10) / 10;
    const fat = Math.round((16 + commentLength * 0.18) * 10) / 10;
    const carbs = Math.round((55 + commentLength * 0.32) * 10) / 10;
    const estimatedWeightG = this.estimateWeightFromCalories(calories);

    return {
      dishName: 'Блюдо по фото (заглушка)',
      dishDescription: this.descriptionFromComment(input.comment),
      caloriesKcal: calories,
      proteinG: protein,
      fatG: fat,
      carbsG: carbs,
      estimatedWeightG,
      confidence: 0.54,
      aiModel,
      needsUserConfirmation: true,
      isStub: true,
    };
  }

  private descriptionFromComment(comment?: string): string {
    if (!comment?.trim()) {
      return 'Оценка сделана по фото. Проверьте КБЖУ перед сохранением.';
    }

    return `Оценка по фото и комментарию: ${comment.trim().slice(0, 120)}`;
  }

  private buildProxyRequest(
    input: AnalyzeInput,
    includeImage: boolean,
  ): Record<string, unknown> {
    const imageUrl = includeImage
      ? this.resolvePublicPhotoUrl(input.photoPath)
      : undefined;

    const userContent: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: this.buildUserPrompt(input.comment, input.photoPath, imageUrl),
      },
    ];

    if (imageUrl) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'auto',
        },
      });
    }

    return {
      input: [
        {
          role: 'system',
          content:
            'Ты AI-ассистент нутрициолога. Возвращай только JSON без Markdown.',
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      stream: false,
      temperature: this.readTemperature(),
    };
  }

  private buildUserPrompt(
    comment: string | undefined,
    photoPath: string,
    imageUrl: string | undefined,
  ): string {
    const normalizedComment = comment?.trim();
    const imageLine = imageUrl
      ? `Изображение приложено по ссылке: ${imageUrl}`
      : `Изображение не приложено. Путь в приложении: ${photoPath}`;

    return [
      'Оцени блюдо по фото и ответь строго JSON-объектом без пояснений.',
      'Поля JSON:',
      'dish_name, dish_description, estimated_weight_g, calories_per_100g_kcal, protein_per_100g, fat_per_100g, carbs_per_100g, calories_kcal, protein_g, fat_g, carbs_g, confidence, needs_user_confirmation.',
      'Сначала оцени показатели на 100 г (calories_per_100g_kcal, protein_per_100g, fat_per_100g, carbs_per_100g), затем умножь их на estimated_weight_g / 100 и заполни итоговые calories_kcal/protein_g/fat_g/carbs_g.',
      'Если в комментарии есть вес порции (например "300 г"), используй его как estimated_weight_g.',
      'confidence должен быть числом от 0 до 1.',
      `Комментарий пользователя: ${normalizedComment ? normalizedComment : 'не указан'}.`,
      imageLine,
    ].join('\n');
  }

  private resolvePublicPhotoUrl(photoPath: string): string | undefined {
    if (!photoPath.trim()) {
      return undefined;
    }

    if (/^https?:\/\//i.test(photoPath)) {
      return photoPath;
    }

    const imagePublicBaseUrl = this.readImagePublicBaseUrl();
    if (!imagePublicBaseUrl) {
      this.logger.warn(
        'AI_IMAGE_PUBLIC_BASE_URL is not configured, photo URL cannot be attached for AI analysis',
      );
      return undefined;
    }

    const normalizedPath = photoPath.startsWith('/')
      ? photoPath
      : `/${photoPath}`;
    try {
      const baseUrl = imagePublicBaseUrl.endsWith('/')
        ? imagePublicBaseUrl
        : `${imagePublicBaseUrl}/`;
      return new URL(normalizedPath, baseUrl).toString();
    } catch (error) {
      this.logger.warn(
        `AI_IMAGE_PUBLIC_BASE_URL is invalid or photoPath cannot be resolved: ${String(error)}`,
      );
      return undefined;
    }
  }

  private async callMicroservice(
    microserviceUrl: string,
    requestBody: Record<string, unknown>,
  ): Promise<Response> {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.readTimeoutMs(),
    );

    try {
      return await fetch(microserviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify(requestBody),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractImageUrlFromRequest(
    requestBody: Record<string, unknown>,
  ): string | undefined {
    const input = requestBody.input;
    if (!Array.isArray(input)) {
      return undefined;
    }

    for (const message of input) {
      const messageRecord = this.toRecord(message);
      if (!messageRecord) {
        continue;
      }

      const content = messageRecord.content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        const partRecord = this.toRecord(part);
        if (!partRecord) {
          continue;
        }

        if (partRecord.type !== 'image_url') {
          continue;
        }

        const imageUrlRecord = this.toRecord(partRecord.image_url);
        const url = imageUrlRecord?.url;
        if (typeof url === 'string' && url.trim()) {
          return url.trim();
        }
      }
    }

    return undefined;
  }

  private async readResponseBody(response: Response): Promise<string> {
    try {
      const text = await response.text();
      if (!text.trim()) {
        return '';
      }

      return text.slice(0, 1000);
    } catch {
      return '';
    }
  }

  private extractAiPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (this.containsAnalysisKeys(payload)) {
      return payload;
    }

    const nestedResponseValue = payload.response;
    const nestedResponse = this.toRecord(nestedResponseValue);
    if (nestedResponse && this.containsAnalysisKeys(nestedResponse)) {
      return nestedResponse;
    }

    if (typeof nestedResponseValue === 'string') {
      const parsedNestedResponse = this.parseJsonObject(nestedResponseValue);
      if (
        parsedNestedResponse &&
        this.containsAnalysisKeys(parsedNestedResponse)
      ) {
        return parsedNestedResponse;
      }
    }

    const outputText =
      this.extractOutputText(payload) ??
      (nestedResponse ? this.extractOutputText(nestedResponse) : undefined);
    if (!outputText) {
      return undefined;
    }

    const parsed = this.parseJsonObject(outputText);
    if (parsed && this.containsAnalysisKeys(parsed)) {
      return parsed;
    }

    return undefined;
  }

  private extractOutputText(
    payload: Record<string, unknown>,
  ): string | undefined {
    const directOutputText = this.pickString(payload, [
      'output_text',
      'text',
      'message',
      'content',
      'response',
      'result',
      'answer',
    ]);
    if (directOutputText) {
      return directOutputText;
    }

    const output = payload.output;
    if (Array.isArray(output)) {
      for (const item of output) {
        const itemRecord = this.toRecord(item);
        if (!itemRecord) {
          continue;
        }

        const content = itemRecord.content;
        if (!Array.isArray(content)) {
          continue;
        }

        for (const contentItem of content) {
          const contentRecord = this.toRecord(contentItem);
          if (!contentRecord) {
            continue;
          }

          const outputText = this.pickString(contentRecord, [
            'text',
            'output_text',
          ]);
          if (outputText) {
            return outputText;
          }
        }
      }
    }

    const choices = payload.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const firstChoice = this.toRecord(choices[0]);
      const message = this.toRecord(firstChoice?.message);
      const content = message?.content;

      if (typeof content === 'string' && content.trim()) {
        return content.trim();
      }

      if (Array.isArray(content)) {
        for (const part of content) {
          const partRecord = this.toRecord(part);
          const outputText = this.pickString(partRecord ?? {}, ['text']);
          if (outputText) {
            return outputText;
          }
        }
      }
    }

    return undefined;
  }

  private parseJsonObject(text: string): Record<string, unknown> | undefined {
    const trimmed = text.trim();
    if (!trimmed) {
      return undefined;
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

    const direct = this.parseRecord(candidate);
    if (direct) {
      return direct;
    }

    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) {
      return undefined;
    }

    return this.parseRecord(candidate.slice(start, end + 1));
  }

  private parseRecord(value: string): Record<string, unknown> | undefined {
    try {
      return this.toRecord(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  private containsAnalysisKeys(payload: Record<string, unknown>): boolean {
    if (
      'nutrition_per_100g' in payload ||
      'nutritionPer100g' in payload ||
      'per100g' in payload
    ) {
      return true;
    }

    return [
      'dish_name',
      'dishName',
      'calories_kcal',
      'caloriesKcal',
      'calories_per_100g_kcal',
      'caloriesPer100gKcal',
      'protein_g',
      'proteinG',
      'protein_per_100g',
      'proteinPer100g',
      'fat_g',
      'fatG',
      'fat_per_100g',
      'fatPer100g',
      'carbs_g',
      'carbsG',
      'carbs_per_100g',
      'carbsPer100g',
      'estimated_weight_g',
      'estimatedWeightG',
      'confidence',
    ].some((key) => key in payload);
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private resolveMicroserviceUrl(): string | undefined {
    const configured = this.configService.get<string>('AI_MICROSERVICE_URL');
    if (configured?.trim()) {
      return configured.trim();
    }

    return DEFAULT_AI_MICROSERVICE_URL;
  }

  private readTimeoutMs(): number {
    const raw = this.configService.get<string>('AI_MICROSERVICE_TIMEOUT_MS');
    const parsed = Number.parseInt(raw ?? '', 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return DEFAULT_ANALYZE_TIMEOUT_MS;
  }

  private readTemperature(): number {
    const raw = this.configService.get<string>('AI_MICROSERVICE_TEMPERATURE');
    const parsed = Number.parseFloat(raw ?? '');
    if (!Number.isFinite(parsed)) {
      return DEFAULT_TEMPERATURE;
    }

    return Math.max(0, Math.min(2, parsed));
  }

  private readImagePublicBaseUrl(): string | undefined {
    const raw = this.configService.get<string>('AI_IMAGE_PUBLIC_BASE_URL');
    if (!raw?.trim()) {
      return undefined;
    }

    return raw.trim();
  }

  private pickString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }

  private pickNumber(
    payload: Record<string, unknown>,
    keys: string[],
  ): number | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  private pickBoolean(
    payload: Record<string, unknown>,
    keys: string[],
  ): boolean | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
          return true;
        }
        if (normalized === 'false') {
          return false;
        }
      }
    }

    return undefined;
  }

  private clamp01(value: number): number {
    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
  }

  private normalizeWeightG(weightG: number): number {
    return Math.round(this.clampRange(weightG, 30, 2_000));
  }

  private roundToOne(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private estimateWeightFromCalories(caloriesKcal: number): number {
    const estimatedWeight = caloriesKcal / 1.7;
    return this.normalizeWeightG(estimatedWeight);
  }

  private clampRange(value: number, min: number, max: number): number {
    if (value < min) {
      return min;
    }

    if (value > max) {
      return max;
    }

    return value;
  }
}
