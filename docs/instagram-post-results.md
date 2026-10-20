# Published-post results

Open an Instagram-confirmed published post in `/content`, then click View results. The compact section shows Likes, Comments, Reach, Saves, Shares and Views, with Instagram as source and the time checked. Missing, unsupported or hidden values display an em dash; genuine zero is preserved. No automatic refresh or analytics writes are added.

Owner-only GET `/api/instagram/analytics?id=<calendar-post-uuid>` resolves the latest confirmed published job for the approved account. It never accepts a provider media ID or account from the browser. Media engagement uses existing basic permission. Insights reads run only when the saved grant includes `instagram_business_manage_insights`; individual unsupported metrics cannot erase other valid results. Views availability depends on Meta's API version and media support. These counts do not attribute sales, measure campaign spend or call Meta Ads/Marketing APIs.

Enable Insights is a separate deliberate consent action shown only when the grant is missing. POST `/api/instagram/connect` accepts either the ordinary empty request or `{ "analytics": true }`; only the latter adds the exact optional Insights scope. The callback still pins the approved professional account before replacing credentials. Existing publishing requires the same base permissions and continues without Insights. Analytics reads use the saved token without refreshing/rotating credentials.

No migration, environment change, new credential, permission grant or subscription is required to release the code. Meta app Insights entitlement and the owner's actual grant remain separate prerequisites for fuller results. Only the owner should initiate and approve that consent flow.

Validation: `npm run test:instagram`, `npm run typecheck`, targeted ESLint, `npm run build`. Provider and consent tests use offline synthetic ports; no live OAuth, posting, messaging or analytics provider calls are made by tests.
