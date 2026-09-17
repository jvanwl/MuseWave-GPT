const account = {
  id: "demo-user",
  planId: "free",
  creditsRemaining: 25,
  creditsUsed: 0,
  projects: [],
  learningEnabled: false,
  feedback: [],
  modelVersion: null,
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

export function setLearningConsent(enabled) {
  account.learningEnabled = Boolean(enabled);
  return getLearningStatus();
}

export function recordFeedback(event) {
  if (!account.learningEnabled) throw new Error("Personalization consent is required");
  const existing = account.projects.find((project) => project.id === event.projectId);
  if (!existing) throw new Error("Project not found");
  account.feedback.push({ ...event, createdAt: new Date().toISOString() });
  account.feedback = account.feedback.slice(-500);
  return getLearningStatus();
}

export function getLearningStatus() {
  return {
    enabled: account.learningEnabled,
    feedbackCount: account.feedback.length,
    minimumForTraining: 10,
    readyToTrain: account.feedback.length >= 10,
    modelVersion: account.modelVersion,
    privacyMode: "per-user",
  };
}

export function exportTrainingExamples() {
  return account.feedback.map((event) => {
    const project = account.projects.find((item) => item.id === event.projectId);
    return { project, rating: event.rating, tags: event.tags ?? [] };
  }).filter((item) => item.project);
}

export function resetStore() {
  account.planId = "free";
  account.creditsRemaining = 25;
  account.creditsUsed = 0;
  account.projects = [];
  account.learningEnabled = false;
  account.feedback = [];
  account.modelVersion = null;
}
