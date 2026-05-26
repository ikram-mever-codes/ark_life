export const SUBSCRIPTION_PLANS = {
  free: {
    maxAvatars: 1,
    monthlyMessages: 10,
    dailyCredits: 2, // e.g., daily free refill
    voiceCloningAllowed: false,
    advancedKnowledgeBase: false,
  },
  pro: {
    maxAvatars: 5,
    monthlyMessages: 500,
    dailyCredits: 50,
    voiceCloningAllowed: true,
    advancedKnowledgeBase: true,
  },
  business: {
    maxAvatars: 20,
    monthlyMessages: Infinity,
    dailyCredits: 200,
    voiceCloningAllowed: true,
    advancedKnowledgeBase: true,
  },
};

export const TIER_LIMITS = {
  free: { maxAvatars: 1, maxMemoryChunks: 100, dailyCredits: 10 },
  pro: { maxAvatars: 5, maxMemoryChunks: 1000, dailyCredits: 100 },
  business: { maxAvatars: 20, maxMemoryChunks: 5000, dailyCredits: 500 },
};
