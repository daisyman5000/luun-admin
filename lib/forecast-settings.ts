import {z} from 'zod';
import type {OperatingChoice} from './operating-timeline';
/** Only owner-scheduled plan dates are file-backed; financial rules remain in code. */
export const forecastSettingsSchema=z.object({version:z.literal(1),scheduledPurchaseDates:z.array(z.iso.date()).max(20)}).strict().refine(s=>s.scheduledPurchaseDates.every((d,i)=>i===0||d>=s.scheduledPurchaseDates[i-1]),'Purchase dates must be chronological');
export function applyForecastSettings(choice:OperatingChoice,raw:unknown):OperatingChoice{
 const settings=forecastSettingsSchema.parse(raw);
 return {...choice,scheduledPurchaseDates:settings.scheduledPurchaseDates};
}
