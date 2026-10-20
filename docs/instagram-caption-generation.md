# Instagram image captions

Upload a JPEG in the calendar composer, then click Generate caption. Existing text changes only after an explicit Regenerate caption action succeeds. Review/edit the result; Save draft and Publish now remain separate actions.

Owner/admin, same-origin POST `/api/instagram/caption` accepts only a stored media UUID. The server downloads the private JPEG, verifies its metadata/hash and sends its bytes plus fixed Luun voice guidance to the existing OpenAI Responses endpoint. No current caption, orders, financial data, Meta credentials, storage signed URL or publishing request is sent. Responses use `store:false`, no tools and no automatic retries.

The existing `OPENAI_API_KEY` is required. Model reuses `OPENAI_SUMMARY_MODEL`, falling back to the app's established `gpt-4.1-mini`. No new credential is created. Missing configuration returns an explicit 503; provider authentication, rate limits and timeouts never return a fake caption or erase text. Provider details are sanitized. Production key presence and live provider success remain unverified because production environment metadata access is denied. Do not work around that denial.

Voice is adapted from Creative Lab's warm, understated delivery and existing “Same sofa. A different home.” copy; no formal saved brand-voice profile was found. Captions are capped at 25 words and 240 characters. Instructions restrict copy to visible details and prohibit unsupported product, material, sale, date and availability claims. Owner review remains necessary.

Client duplicate clicks are prevented synchronously and editing is locked during generation. A one-minute per-actor process-local burst guard follows the existing Wise refresh pattern. It is not a distributed account-wide quota across serverless instances. No database changes or new rate-limit service were introduced.

Validation: `npm run test:instagram`, `npm run typecheck`, targeted ESLint, `npm run build`. Provider tests are mocked. Live acceptance: signed-in owner uploads a real JPEG; Generate returns a brief image-specific caption; owner edits remain editable; no post is published until Publish now is deliberately clicked. Do not publish as a caption-generation test.
