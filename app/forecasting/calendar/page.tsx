import { ForecastingWorkspace } from "@/components/forecasting-workspace";
import { requireUser } from "@/lib/auth";

export default async function CalendarForecastingPage() {
  await requireUser();

  return (
    <main className="px-4 py-4 sm:px-6 lg:px-8">
      <ForecastingWorkspace view="calendar" />
    </main>
  );
}
