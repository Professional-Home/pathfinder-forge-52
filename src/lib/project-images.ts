/** Local project images */
export const PROJECT_IMAGES = {
  bioplastic: {
    thumbnail: "/Photos/bioplastic-card.jpeg",
    cover: "/Photos/bioplastic-hero.jpeg",
    lab: "/Photos/bioplastic-card.jpeg",
  },
  drugDiscovery: {
    thumbnail: "/Photos/ai-drug-discovery-card.jpeg",
    cover: "/Photos/ai-drug-discovery-hero.jpeg",
    ai: "/Photos/ai-drug-discovery-card.jpeg",
  },
  /** Temporary: reusing AI drug discovery images until dedicated bioinformatics images are provided.
   *  To replace, update ONLY these two paths below. */
  bioinformatics: {
    thumbnail: "/Photos/ai-drug-discovery-card.jpeg",
    cover: "/Photos/ai-drug-discovery-hero.jpeg",
  },
} as const;