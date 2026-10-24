import {createSign} from 'node:crypto';
import {GA4_EVENTS, LUUN_GA4_PROPERTY, ga4Number, parseGA4Events, validGA4Range, type GA4Report} from './ga4';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
type Options = {fetcher?: typeof fetch; credential: string; now?: () => number};
export function createGA4Reader(options: Options) {
  const fetcher = options.fetcher || fetch, now = options.now || Date.now;
  const credential = JSON.parse(options.credential) as {type?: string; client_email?: string; private_key?: string};
  if (credential.type !== 'service_account' || !credential.client_email?.endsWith('.iam.gserviceaccount.com') || !credential.private_key?.includes('BEGIN PRIVATE KEY')) throw Error('Invalid Analytics connection');
  let token: {value: string; expires: number} | null = null;
  let pendingToken: Promise<string> | null = null;
  async function readJSON(url: string, body: string, headers: Record<string, string>) {
    const response = await fetcher(url, {method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store'});
    if (!response.ok) throw Error(`Analytics read failed (${response.status})`);
    const raw = await response.text();
    if (raw.length > 250000) throw Error('Analytics response exceeds limit');
    return JSON.parse(raw);
  }
  async function accessToken(): Promise<string> {
    if (token && token.expires > now()) return token.value;
    if (pendingToken) return pendingToken;
    pendingToken = (async () => {
      const issued = Math.floor(now() / 1000);
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = encode({alg: 'RS256', typ: 'JWT'}) + '.' + encode({iss: credential.client_email, scope: SCOPE, aud: TOKEN_URL, iat: issued, exp: issued + 3600});
      const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
      const assertion = unsigned + '.' + signer.sign(credential.private_key!, 'base64url');
      const result = await readJSON(TOKEN_URL, new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion}).toString(), {'Content-Type': 'application/x-www-form-urlencoded'});
      if (typeof result.access_token !== 'string' || result.access_token.length > 8192 || !Number.isFinite(result.expires_in) || result.expires_in < 60) throw Error('Analytics authentication failed');
      token = {value: result.access_token, expires: now() + Math.min(result.expires_in, 3600) * 1000 - 30000};
      return token.value;
    })();
    try { return await pendingToken; } finally { pendingToken = null; }
  }
  return async (from: string, through: string): Promise<GA4Report> => {
    if (!validGA4Range(from, through)) throw Error('Invalid Analytics date range');
    const dateRanges = [{startDate: from, endDate: through}];
    const result = await readJSON(`https://analyticsdata.googleapis.com/v1beta/properties/${LUUN_GA4_PROPERTY}:batchRunReports`, JSON.stringify({requests: [
      {dateRanges, dimensions: [{name: 'eventName'}], metrics: [{name: 'eventCount'}, {name: 'totalUsers'}], dimensionFilter: {filter: {fieldName: 'eventName', inListFilter: {values: GA4_EVENTS, caseSensitive: true}}}, limit: '100'},
      {dateRanges, metrics: [{name: 'sessions'}, {name: 'totalUsers'}], limit: '1'}
    ]}), {Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json'});
    if (!Array.isArray(result.reports) || result.reports.length !== 2) throw Error('Analytics reports incomplete');
    const [events, totals] = result.reports;
    if (totals.metricHeaders?.[0]?.name !== 'sessions' || totals.metricHeaders?.[1]?.name !== 'totalUsers') throw Error('Unexpected Analytics totals');
    const warnings = result.reports.flatMap((r: {metadata?: {subjectToThresholding?: boolean; samplingMetadatas?: unknown[]; dataLossFromOtherRow?: boolean}}) => r.metadata?.subjectToThresholding || r.metadata?.samplingMetadatas?.length || r.metadata?.dataLossFromOtherRow ? ['Google reports limited or sampled coverage.'] : []);
    return {propertyId: LUUN_GA4_PROPERTY, from, through, fetchedAt: new Date(now()).toISOString(), timeZone: events.metadata?.timeZone || null, source: 'api', events: parseGA4Events(events), sessions: totals.rows?.length ? ga4Number(totals.rows[0].metricValues?.[0]?.value) : 0, totalUsers: totals.rows?.length ? ga4Number(totals.rows[0].metricValues?.[1]?.value) : 0, warning: warnings[0]};
  };
}
