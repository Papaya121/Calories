import {
  AnalyzeMealResponse,
  AuthSession,
  CalendarRangeResponse,
  DayDetailsResponse,
  MealEntry,
} from "@/lib/types";

const DEFAULT_API_BASE_URL = "http://192.168.0.240:3232/api/v1";
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
const API_ORIGIN = new URL(API_BASE_URL).origin;

type Primitive = string | number | boolean | null | undefined;

type ApiMessagePayload = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | null;
  token?: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function isMealWithPhotoUrl(value: unknown): value is MealEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "photoUrl" in value &&
    typeof (value as { photoUrl: unknown }).photoUrl === "string"
  );
}

function toJsonBody(payload: Record<string, Primitive>): string {
  return JSON.stringify(payload);
}

function withApiBase(path: string): string {
  return path.startsWith("/")
    ? `${API_BASE_URL}${path}`
    : `${API_BASE_URL}/${path}`;
}

function normalizeMeal(meal: MealEntry): MealEntry {
  if (meal.photoUrl.startsWith("/uploads/")) {
    return {
      ...meal,
      photoUrl: `${API_ORIGIN}${meal.photoUrl}`,
    };
  }

  return meal;
}

function extractApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as ApiMessagePayload;
  if (typeof data.message === "string") {
    return data.message;
  }

  if (Array.isArray(data.message)) {
    return data.message.join(", ");
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  return null;
}

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof ApiError) {
    return extractApiMessage(error.details) || error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

async function request<T>(
  path: string,
  { token, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const finalHeaders = new Headers(headers);

  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(withApiBase(path), {
    ...init,
    headers: finalHeaders,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      extractApiMessage(payload) ||
      `HTTP ${response.status} ${response.statusText}`;
    throw new ApiError(response.status, message, payload);
  }

  if (isMealWithPhotoUrl(payload)) {
    return normalizeMeal(payload) as T;
  }

  if (Array.isArray(payload) && payload.every(isMealWithPhotoUrl)) {
    return payload.map(normalizeMeal) as T;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "meals" in payload &&
    Array.isArray((payload as { meals?: unknown[] }).meals)
  ) {
    const data = payload as DayDetailsResponse;
    return {
      ...data,
      meals: data.meals.map(normalizeMeal),
    } as T;
  }

  return payload as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function authBootstrap(input: {
  passcode: string;
  displayName?: string;
  deviceName?: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/bootstrap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: toJsonBody({
      passcode: input.passcode,
      displayName: input.displayName,
      deviceName: input.deviceName,
    }),
  });
}

export async function authPasscodeLogin(input: {
  passcode: string;
  deviceName?: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/passcode/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: toJsonBody({
      passcode: input.passcode,
      deviceName: input.deviceName,
    }),
  });
}

export async function authWebauthnVerify(input: {
  assertionId: string;
  deviceName?: string;
}): Promise<AuthSession> {
  const result = await request<AuthSession & { isStub: boolean }>(
    "/auth/webauthn/verify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: toJsonBody({
        assertionId: input.assertionId,
        deviceName: input.deviceName,
      }),
    },
  );

  return {
    accessToken: result.accessToken,
    accessExpiresInSec: result.accessExpiresInSec,
    user: result.user,
  };
}

export async function authLogout(): Promise<void> {
  await request<{ success: true }>("/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function analyzeMeal(
  token: string,
  input: {
    photo: File;
    comment?: string;
  },
): Promise<AnalyzeMealResponse> {
  const formData = new FormData();
  formData.append("photo", input.photo);

  const comment = input.comment?.trim();
  if (comment) {
    formData.append("comment", comment);
  }

  return request<AnalyzeMealResponse>("/meals/analyze", {
    method: "POST",
    token,
    body: formData,
  });
}

export async function createMeal(
  token: string,
  payload: {
    eatenAt: string;
    comment?: string;
    dishName: string;
    dishDescription?: string;
    caloriesKcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    confidence: number;
    photoPath: string;
    aiModel?: string;
    isUserEdited?: boolean;
  },
): Promise<MealEntry> {
  return request<MealEntry>("/meals", {
    method: "POST",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: toJsonBody(payload),
  });
}

export async function getMeal(
  token: string,
  mealId: string,
): Promise<MealEntry> {
  return request<MealEntry>(`/meals/${mealId}`, {
    method: "GET",
    token,
  });
}

export async function updateMeal(
  token: string,
  mealId: string,
  payload: {
    comment?: string;
    dishName?: string;
    dishDescription?: string;
    caloriesKcal?: number;
    proteinG?: number;
    fatG?: number;
    carbsG?: number;
    confidence?: number;
    aiModel?: string;
    isUserEdited?: boolean;
  },
): Promise<MealEntry> {
  return request<MealEntry>(`/meals/${mealId}`, {
    method: "PATCH",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: toJsonBody(payload),
  });
}

export async function deleteMeal(token: string, mealId: string): Promise<void> {
  await request<{ success: true }>(`/meals/${mealId}`, {
    method: "DELETE",
    token,
  });
}

export async function getDayDetails(
  token: string,
  date: string,
): Promise<DayDetailsResponse> {
  return request<DayDetailsResponse>(`/days/${date}`, {
    method: "GET",
    token,
  });
}

export async function getCalendarRange(
  token: string,
  from: string,
  to: string,
): Promise<CalendarRangeResponse> {
  const query = new URLSearchParams({ from, to }).toString();
  return request<CalendarRangeResponse>(`/calendar?${query}`, {
    method: "GET",
    token,
  });
}
