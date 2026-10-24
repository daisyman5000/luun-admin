import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {createGA4Reader} from './ga4-client';
import {getVercelOidcToken} from '@vercel/oidc';
import {createKeylessGA4Token, GA4_OIDC_AUDIENCE} from './ga4-keyless';
import {LUUN_GA4_PROPERTY, validateGA4Snapshot, type GA4Report} from './ga4';
let reader: ReturnType<typeof createGA4Reader> | null = null;
const cache = new Map<string, {until: number; report: GA4Report}>();
export async function loadGA4Overview(from: string, through: string): Promise<{report: GA4Report | null; connection: string}> {
  let connection = 'Automatic GA4 connection is not configured yet.';
  if (process.env.LUUN_GA4_KEYLESS_ENABLED === 'true' || process.env.LUUN_GA4_SERVICE_ACCOUNT_JSON) {
    try {
      reader ||= createGA4Reader(process.env.LUUN_GA4_KEYLESS_ENABLED === 'true'
        ? {accessToken: createKeylessGA4Token({oidcToken: () => getVercelOidcToken({audience: GA4_OIDC_AUDIENCE})})}
        : {credential: process.env.LUUN_GA4_SERVICE_ACCOUNT_JSON});
      const key = from + ':' + through, saved = cache.get(key);
      if (saved && saved.until > Date.now()) return {report: saved.report, connection: 'Connected to Google Analytics · refreshed at most every 5 minutes.'};
      const report = await reader(from, through);
      if (cache.size >= 8) cache.clear();
      cache.set(key, {until: Date.now() + 300000, report});
      return {report, connection: 'Connected to Google Analytics · refreshed at most every 5 minutes.'};
    } catch { connection = 'Google Analytics could not refresh. Showing the last imported report if available.'; }
  }
  const saved = await createAdminClient().from('funnel_reviews').select('package').eq('package->>kind', 'ga4_import').eq('package->>propertyId', LUUN_GA4_PROPERTY).order('created_at', {ascending: false}).limit(1);
  if (!saved.error && saved.data?.[0]?.package?.report) {
    try { return {report: validateGA4Snapshot(saved.data[0].package.report), connection}; } catch { /* Invalid saved data is not displayed. */ }
  }
  return {report: null, connection};
}
