import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "node:crypto";
import test from "node:test";
import { hasValidGrokBotBearer } from "./grok-bot-auth.ts";

const previousSecret = process.env.GROK_BOT_SECRET;

test.afterEach(() => {
  if (previousSecret === undefined) {
    delete process.env.GROK_BOT_SECRET;
  } else {
    process.env.GROK_BOT_SECRET = previousSecret;
  }
});

test("accepts a matching Bearer token with a timing-safe compare", () => {
  process.env.GROK_BOT_SECRET = "jobs-bot-test-secret";
  const expected = createHash("sha256").update("jobs-bot-test-secret").digest();
  const provided = createHash("sha256").update("jobs-bot-test-secret").digest();

  assert.equal(hasValidGrokBotBearer("Bearer jobs-bot-test-secret"), true);
  assert.equal(hasValidGrokBotBearer("bearer jobs-bot-test-secret"), true);
  assert.ok(timingSafeEqual(expected, provided));
});

test("rejects missing, malformed, or non-matching credentials", () => {
  process.env.GROK_BOT_SECRET = "jobs-bot-test-secret";

  assert.equal(hasValidGrokBotBearer(null), false);
  assert.equal(hasValidGrokBotBearer(""), false);
  assert.equal(hasValidGrokBotBearer("jobs-bot-test-secret"), false);
  assert.equal(hasValidGrokBotBearer("Basic jobs-bot-test-secret"), false);
  assert.equal(hasValidGrokBotBearer("Bearer wrong-secret"), false);
  assert.equal(hasValidGrokBotBearer("Bearer short"), false);
});

test("rejects bearer tokens when the secret is unset", () => {
  delete process.env.GROK_BOT_SECRET;
  assert.equal(hasValidGrokBotBearer("Bearer jobs-bot-test-secret"), false);
});
