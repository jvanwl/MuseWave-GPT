import { FREE_BETA, PLANS } from "./plans.mjs";

export function billingStatus(account) {
  return {
    freeBeta: FREE_BETA,
    billingEnabled: !FREE_BETA && Boolean(process.env.BILLING_CHECKOUT_BASE_URL),
    plan: PLANS[account.planId],
    creditsRemaining: account.creditsRemaining,
    creditsUsed: account.creditsUsed,
    currency: "USD",
  };
}

export function checkoutFor(planId) {
  const plan = PLANS[planId];
  if (!plan || plan.id === "free") throw new Error("Unknown paid plan");
  if (FREE_BETA) {
    return { enabled: false, freeBeta: true, url: null, message: "Paid plans are preview-only during the free beta." };
  }
  const base = process.env.BILLING_CHECKOUT_BASE_URL;
  if (!base) throw new Error("Billing is not configured");
  const url = new URL(base);
  url.searchParams.set("plan", plan.id);
  url.searchParams.set("client_reference_id", "demo-user");
  return { enabled: true, freeBeta: false, url: url.toString(), message: `Continue to ${plan.name} checkout.` };
}
