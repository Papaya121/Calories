import Link from 'next/link';
import Image from 'next/image';

import { formatTime } from '@/lib/date';
import { MealEntry } from '@/lib/types';

export function MealCard({ meal }: { meal: MealEntry }) {
  return (
    <Link
      href={`/meal/${meal.id}`}
      className="block rounded-3xl border border-white/90 bg-card p-4 shadow-card transition-transform duration-200 ease-ios hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <Image
          src={meal.photoUrl}
          alt={meal.dishName}
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-medium text-text">{meal.dishName}</p>
            <span className="text-xs text-subtext">{formatTime(meal.eatenAt)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-subtext">{meal.dishDescription}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2 py-1">{meal.caloriesKcal} ккал</span>
            <span className="rounded-full bg-protein/15 px-2 py-1 text-protein">Б {meal.proteinG}</span>
            <span className="rounded-full bg-fat/15 px-2 py-1 text-fat">Ж {meal.fatG}</span>
            <span className="rounded-full bg-carbs/15 px-2 py-1 text-carbs">У {meal.carbsG}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
