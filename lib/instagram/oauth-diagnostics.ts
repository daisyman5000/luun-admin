/** Fixed diagnostic vocabulary only: never retain provider payloads or OAuth parameters. */
export const oauthStages=['owner','configuration','callback_origin','state_validation','short_token','permissions','account_match','long_token','profile','connection_storage','unknown'] as const;
export type OAuthStage=typeof oauthStages[number];
const reasons={instagram_owner_required:'owner_required',instagram_setup_required:'setup_required',instagram_state_invalid:'state_invalid',instagram_callback_rejected:'callback_rejected',instagram_state_unavailable:'state_expired_or_used',instagram_authorization_denied:'provider_authorization_error',instagram_code_invalid:'code_missing_or_invalid',instagram_permissions_incomplete:'permissions_incomplete',instagram_account_mismatch:'account_mismatch',instagram_identifier_invalid:'identifier_invalid',instagram_network_unavailable:'provider_unreachable',instagram_rate_limited:'provider_rate_limited',instagram_reconnect_required:'provider_auth_rejected',instagram_request_rejected:'provider_rejected',instagram_response_unconfirmed:'provider_response_unconfirmed',instagram_token_unconfirmed:'token_response_unconfirmed',instagram_storage_unavailable:'storage_unavailable',instagram_token_invalid:'encryption_configuration'} as const;
export type OAuthFailure={stage:OAuthStage;reason:typeof reasons[keyof typeof reasons]|'unexpected_failure'};
export const OAUTH_DIAGNOSTIC_COOKIE='__Secure-luun-instagram-diagnostic';
export function oauthFailure(stage:OAuthStage,error:unknown):OAuthFailure{
 const code=error instanceof Error?error.message:'';
 return {stage:oauthStages.includes(stage)?stage:'unknown',reason:Object.hasOwn(reasons,code)?reasons[code as keyof typeof reasons]:'unexpected_failure'};
}
export function readOAuthFailure(value:string|undefined):OAuthFailure|null{
 if(!value||value.length>256)return null;
 try{const v=JSON.parse(value);if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==2||!oauthStages.includes(v.stage)||![...Object.values(reasons),'unexpected_failure'].includes(v.reason))return null;return {stage:v.stage,reason:v.reason};}catch{return null;}
}
