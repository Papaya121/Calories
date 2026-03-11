import { BottomNav } from '@/components/bottom-nav';

export function ScreenShell({
  title,
  subtitle,
  children,
  showNav = true
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showNav?: boolean;
}) {
  return (
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-4 pb-28 pt-8">
        <header className="mb-6">
          <p className="text-sm text-subtext">Calories</p>
          <h1 className="text-3xl font-semibold text-text">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-subtext">{subtitle}</p> : null}
        </header>
        <section className="flex flex-1 flex-col gap-4">{children}</section>
      </main>
      {showNav ? <BottomNav /> : null}
    </>
  );
}
