import { LogisticsGlobe } from "@/components/logistics/LogisticsGlobe";
import { requireUser } from "@/lib/auth";

export default async function ForecastingPage() {
  await requireUser();

  return (
    <main className="px-4 py-4 sm:px-6 lg:px-8">
      <LogisticsGlobe />
    </main>
  );
}
