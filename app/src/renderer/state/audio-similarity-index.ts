import type { AudioSimilarityReport, AudioSimilarityRelationshipType } from "../../shared/audio-similarity.js";

export const buildAudioSimilarityIndex = (
  report: Pick<AudioSimilarityReport, "hiddenTrackIds" | "confirmedGroups">,
) => {
  const similarityHiddenTrackIds = new Set(report.hiddenTrackIds);
  const similarityEquivalentTrackIds = new Map<string, ReadonlySet<string>>();
  const similarityRelationshipByTrackId = new Map<string, AudioSimilarityRelationshipType>();
  const similarityPreferredTrackIds = new Map<string, string>();
  const relationshipBreadth: Record<AudioSimilarityRelationshipType, number> = {
    identical: 0, "same-recording": 1, "same-orchestra": 2, "same-composition": 3,
  };
  for (const group of [...report.confirmedGroups].sort((left, right) =>
    left.trackIds.length - right.trackIds.length
      || relationshipBreadth[left.relationshipType] - relationshipBreadth[right.relationshipType])) {
    const members = new Set(group.trackIds);
    for (const trackId of members) {
      similarityEquivalentTrackIds.set(trackId, members);
      similarityRelationshipByTrackId.set(trackId, group.relationshipType);
      if (group.preferredTrackId) similarityPreferredTrackIds.set(trackId, group.preferredTrackId);
    }
  }
  return { similarityHiddenTrackIds, similarityEquivalentTrackIds, similarityRelationshipByTrackId, similarityPreferredTrackIds };
};
