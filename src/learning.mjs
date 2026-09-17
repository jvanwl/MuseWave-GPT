const GENRES = ["Pop", "Electronic", "Hip-hop", "R&B", "Rock", "Ambient", "Latin", "Afrobeats", "Cinematic"];
const MOODS = ["Euphoric", "Dreamy", "Dark", "Romantic", "Focused", "Nostalgic", "Confident", "Peaceful"];

function oneHot(value, choices) {
  return choices.map((choice) => Number(choice === value));
}

export function projectFeatures(project) {
  return [
    ...oneHot(project.genre, GENRES),
    ...oneHot(project.mood, MOODS),
    project.energy / 5,
    Math.min(project.duration, 600) / 600,
    Number(project.mode === "vocal"),
    Number(project.quality === "studio"),
    Math.min(project.bpm, 220) / 220,
    Number(Boolean(project.lyrics?.trim?.())),
  ];
}

export function buildPreferenceProfile(examples) {
  if (!examples.length) return { confidence: 0, topGenres: [], topMoods: [], averageRating: 0 };
  const scores = (field) => Object.entries(examples.reduce((map, item) => {
    const key = item.project[field];
    map[key] = (map[key] ?? 0) + item.rating;
    return map;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  return {
    confidence: Math.min(1, examples.length / 25),
    topGenres: scores("genre"),
    topMoods: scores("mood"),
    averageRating: examples.reduce((sum, item) => sum + item.rating, 0) / examples.length,
  };
}

export const FEATURE_COUNT = GENRES.length + MOODS.length + 6;
