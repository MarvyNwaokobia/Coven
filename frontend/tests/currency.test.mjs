// Display currency follows the device location: time zone first, locale region second.
import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/fakes.mjs";

const { detectCurrency, getCurrency } = await load("lib/currency.ts");

test("time zone decides the currency", () => {
  assert.equal(detectCurrency("Africa/Accra", ["en-US"]), "GHS");
  assert.equal(detectCurrency("Africa/Nairobi", []), "KES");
});

test("falls back to the locale region, then to NGN", () => {
  assert.equal(detectCurrency("Europe/Paris", ["fr-FR", "en-ZA"]), "ZAR");
  assert.equal(detectCurrency("Europe/Paris", ["fr-FR"]), "NGN");
  assert.equal(detectCurrency(undefined, []), "NGN");
});

test("rejects unsupported currency codes", () => {
  assert.equal(getCurrency("XYZ"), null);
  assert.equal(getCurrency("ghs")?.code, "GHS");
});
