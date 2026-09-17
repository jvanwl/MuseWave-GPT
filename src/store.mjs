const account = {
  id: "demo-user",
  planId: "free",
  creditsRemaining: 25,
  creditsUsed: 0,
  projects: [],
};

export function getAccount() {
  return structuredClone(account);
}

export function listProjects() {
  return structuredClone(account.projects);
}

export function saveProject(project, cost, chargeCredits) {
  account.projects.unshift(project);
  account.projects = account.projects.slice(0, 50);
  account.creditsUsed += cost;
  if (chargeCredits) account.creditsRemaining = Math.max(0, account.creditsRemaining - cost);
  return structuredClone(project);
}

export function canSpend(cost, chargeCredits) {
  return !chargeCredits || account.creditsRemaining >= cost;
}

export function resetStore() {
  account.planId = "free";
  account.creditsRemaining = 25;
  account.creditsUsed = 0;
  account.projects = [];
}
