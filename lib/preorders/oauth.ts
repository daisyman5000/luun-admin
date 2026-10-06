import { createHmac, timingSafeEqual } from 'node:crypto';
export const PREORDER_SCOPES = ['read_orders', 'write_products', 'write_purchase_options', 'read_payment_mandate', 'write_payment_mandate'] as const;
export type PreorderAppConfig = { clientId: string; clientSecret: string; shop: string; origin: string };
export function validatePreorderConfig(config: PreorderAppConfig) {
  if (!config.clientId || !config.clientSecret || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.shop)) throw new Error('Preorder app configuration is incomplete');
  const origin = new URL(config.origin);
  if (origin.protocol !== 'https:' || origin.origin !== config.origin) throw new Error('Preorder app requires its configured HTTPS origin');
  return config;
}
export function preorderAuthorizeUrl(config: PreorderAppConfig, state: string) {
  validatePreorderConfig(config);
  if (!/^[a-f0-9]{64}$/.test(state)) throw new Error('Invalid OAuth state');
  const url = new URL('https://' + config.shop + '/admin/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('scope', [...PREORDER_SCOPES, 'write_inventory', 'read_locations'].join(','));
  url.searchParams.set('redirect_uri', config.origin + '/api/preorders/callback');
  url.searchParams.set('state', state);
  return url.toString();
}
export function verifyPreorderCallback(config: PreorderAppConfig, params: URLSearchParams, expectedState: string | undefined) {
  validatePreorderConfig(config);
  const seen = new Set<string>();
  for (const [key] of params) { if (seen.has(key)) return false; seen.add(key); }
  const state = params.get('state');
  const hmac = params.get('hmac');
  if (!expectedState || !state || !/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(expectedState)) return false;
  if (!timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) return false;
  if (params.get('shop') !== config.shop || !params.get('code') || !hmac || !/^[a-f0-9]{64}$/.test(hmac)) return false;
  const message = [...params.entries()].filter(([key]) => key !== 'hmac' && key !== 'signature').sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('&');
  const digest = createHmac('sha256', config.clientSecret).update(message).digest();
  return timingSafeEqual(digest, Buffer.from(hmac, 'hex'));
}
export function missingPreorderScopes(scope: string) {
  const granted = new Set(scope.split(',').map(s => s.trim()));
  // Shopify write permission includes the matching read permission.
  return PREORDER_SCOPES.filter(s => !granted.has(s) && !(s.startsWith('read_') && granted.has('write_' + s.slice(5))));
}
