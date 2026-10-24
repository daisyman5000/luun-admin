// Keyless sign-in is pinned to the approved GA4 reader and production identity pool.
const PROJECT_NUMBER = '539572607640';
const POOL = 'luun-admin-production';
const PROVIDER = 'vercel-production';
const SERVICE_ACCOUNT = 'luun-admin-ga4-reader@striking-coil-512600-d9.iam.gserviceaccount.com';
export const GA4_WORKLOAD_AUDIENCE = `//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}`;
export const GA4_OIDC_AUDIENCE = 'https:' + GA4_WORKLOAD_AUDIENCE;
export function createKeylessGA4Token(options: {oidcToken: () => Promise<string>; fetcher?: typeof fetch; now?: () => number}) {
  const fetcher = options.fetcher || fetch, now = options.now || Date.now;
  let saved: {token: string; expires: number} | null = null;
  let pending: Promise<string> | null = null;
  async function post(url: string, body: unknown, bearer?: string) {
    const response = await fetcher(url, {method: 'POST', headers: {'Content-Type': 'application/json', ...(bearer ? {Authorization: 'Bearer ' + bearer} : {})}, body: JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw Error(`Keyless Analytics authentication failed (${response.status})`);
    const raw = await response.text();
    if (raw.length > 30000) throw Error('Invalid authentication response');
    return JSON.parse(raw);
  }
  return async (): Promise<string> => {
    if (saved && saved.expires > now()) return saved.token;
    if (pending) return pending;
    pending = (async () => {
      const oidc = await options.oidcToken();
      const federated = await post('https://sts.googleapis.com/v1/token', {
        grantType: 'urn:ietf:params:oauth:grant-type:token-exchange', audience: GA4_WORKLOAD_AUDIENCE,
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token', subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
        subjectToken: oidc, scope: 'https://www.googleapis.com/auth/cloud-platform'
      });
      if (typeof federated.access_token !== 'string' || federated.access_token.length > 8192) throw Error('Invalid federation response');
      const result = await post(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SERVICE_ACCOUNT}:generateAccessToken`, {
        scope: ['https://www.googleapis.com/auth/analytics.readonly'], lifetime: '600s'
      }, federated.access_token);
      const expires = Date.parse(result.expireTime);
      if (typeof result.accessToken !== 'string' || result.accessToken.length > 8192 || !Number.isFinite(expires) || expires < now() + 30000 || expires > now() + 3600000) throw Error('Invalid Analytics token');
      saved = {token: result.accessToken, expires: expires - 30000};
      return saved.token;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
