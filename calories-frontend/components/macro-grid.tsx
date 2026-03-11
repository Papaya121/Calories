export function MacroGrid({
  calories,
  protein,
  fat,
  carbs
}: {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}) {
  return (
    <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
      <p className="text-xs uppercase tracking-wide text-subtext">Суммарно</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-muted p-3">
          <p className="text-xs text-subtext">Калории</p>
          <p className="text-2xl font-semibold text-text">{calories}</p>
        </div>
        <div className="rounded-2xl bg-muted p-3">
          <p className="text-xs text-subtext">Белки</p>
          <p className="text-xl font-semibold text-protein">{protein} г</p>
        </div>
        <div className="rounded-2xl bg-muted p-3">
          <p className="text-xs text-subtext">Жиры</p>
          <p className="text-xl font-semibold text-fat">{fat} г</p>
        </div>
        <div className="rounded-2xl bg-muted p-3">
          <p className="text-xs text-subtext">Углеводы</p>
          <p className="text-xl font-semibold text-carbs">{carbs} г</p>
        </div>
      </div>
    </div>
  );
}
