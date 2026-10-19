// Recalculate changed assumptions without blocking chart interactions.
export function createOperatingForecastWorker(){
 return new Worker(new URL('./operating-forecast.worker.ts',import.meta.url));
}
