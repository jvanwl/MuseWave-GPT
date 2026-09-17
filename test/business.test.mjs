import test from "node:test";
import assert from "node:assert/strict";
import { generationCost, PLANS } from "../src/plans.mjs";
import { canSpend, getAccount, getLearningStatus, recordFeedback, resetStore, saveProject, setLearningConsent } from "../src/store.mjs";
import { checkoutFor } from "../src/billing.mjs";
import { buildPreferenceProfile, FEATURE_COUNT, projectFeatures } from "../src/learning.mjs";

test("generation cost scales by duration, quality, and vocals", () => {
  assert.equal(generationCost({ duration: 30, quality: "draft", mode: "instrumental" }), 1);
  assert.equal(generationCost({ duration: 120, quality: "studio", mode: "vocal" }), 5);
});

test("plans expose a clear upgrade ladder", () => {
  assert.equal(PLANS.free.priceMonthly, 0);
  assert.ok(PLANS.creator.monthlyCredits < PLANS.pro.monthlyCredits);
  assert.ok(PLANS.pro.monthlyCredits < PLANS.studio.monthlyCredits);
});

test("free beta tracks usage without deducting credits", () => {
  resetStore();
  const before = getAccount();
  saveProject({ id: "test" }, 3, false);
  const after = getAccount();
  assert.equal(after.creditsRemaining, before.creditsRemaining);
  assert.equal(after.creditsUsed, 3);
  assert.equal(canSpend(999, false), true);
});

test("checkout remains disabled during free beta", () => {
  const checkout = checkoutFor("creator");
  assert.equal(checkout.enabled, false);
  assert.equal(checkout.url, null);
});

test("learning requires consent and converts projects into fixed features", () => {
  resetStore();
  const project = { id: "p1", genre: "Pop", mood: "Dreamy", energy: 4, duration: 60, mode: "vocal", quality: "draft", bpm: 110 };
  saveProject(project, 1, false);
  assert.throws(() => recordFeedback({ projectId: "p1", rating: 5 }));
  setLearningConsent(true);
  recordFeedback({ projectId: "p1", rating: 5 });
  assert.equal(getLearningStatus().feedbackCount, 1);
  assert.equal(projectFeatures(project).length, FEATURE_COUNT);
});

test("preference profile summarizes consented examples", () => {
  const profile = buildPreferenceProfile([{ project: { genre: "Latin", mood: "Confident" }, rating: 5 }]);
  assert.deepEqual(profile.topGenres, ["Latin"]);
  assert.equal(profile.averageRating, 5);
});
