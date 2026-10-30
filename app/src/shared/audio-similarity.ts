export const AUDIO_SIMILARITY_ALGORITHM_VERSION = 1;

export type AudioSimilarityRelationshipType =
  | "identical"
  | "same-recording"
  | "same-orchestra"
  | "same-composition";
export type AudioSimilarityDecision = "pending" | "confirmed" | "rejected";
export type AudioSimilarityRunStatus =
  | "running"
  | "cancelling"
  | "cancelled"
  | "completed"
  | "failed";

export type AudioSimilarityMember = {
  trackId: string;
  title: string;
  artist: string;
  artistSummary: string;
  album: string;
  fullPath: string;
  fileHash: string;
  durationMs: number;
  startOffsetMs: number;
  endTrimMs: number;
  year: string;
  genre: string;
  bpm: number | null;
  notes: string;
  singer: string;
  instrumental: boolean | null;
  loudnessDb: number | null;
  gainDb: number | null;
  usages: Array<{
    tandaId: string;
    tandaName: string;
    position: number;
    playlistNames: string[];
    contextTracks: AudioSimilarityAuditionTrack[];
  }>;
  hidden: boolean;
};

export type AudioSimilarityAuditionTrack = {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  fullPath: string;
  durationMs: number;
  startOffsetMs: number;
  endTrimMs: number;
  loudnessDb: number | null;
  gainDb: number | null;
};

export type ReplicableAudioSimilarityField =
  | "title" | "artist" | "artist_summary" | "singer"
  | "year" | "genre" | "bpm" | "notes" | "instrumental";

export type AudioSimilarityMetadataValue = string | number | boolean | null;

export type AudioSimilarityMetadataChange = {
  trackId: string;
  field: ReplicableAudioSimilarityField;
  oldValue: AudioSimilarityMetadataValue;
  newValue: AudioSimilarityMetadataValue;
};

export type AudioSimilarityMetadataMutationResult = {
  updated: number;
  conflicts: string[];
  changes: AudioSimilarityMetadataChange[];
};

export type AudioSimilarityTandaReference = {
  tandaId: string;
  position: number;
};

export type AudioSimilarityCandidateEdge = {
  leftTrackId: string;
  rightTrackId: string;
  score: number;
  envelopeScore: number;
  chromaScore: number;
  transitionScore: number;
  coarseScore: number;
  pitchShift: number;
  decision: AudioSimilarityDecision;
  updatedAt: string;
};

export type AudioSimilarityCandidateGroup = {
  id: string;
  runId: string;
  confidence: number;
  members: AudioSimilarityMember[];
  edges: AudioSimilarityCandidateEdge[];
};

export type AudioSimilarityReport = {
  hasCompletedReport: boolean;
  status: AudioSimilarityStatus;
  integrity: AudioSimilarityIntegrity;
  candidateGroups: AudioSimilarityCandidateGroup[];
  confirmedGroups: ConfirmedAudioSimilarityGroup[];
  failures: Array<{ trackId: string; title: string; message: string }>;
  hiddenTrackIds: string[];
  hiddenTracks: Array<{ trackId: string; title: string; artist: string; fullPath: string }>;
};

export type AudioSimilarityIntegrity = {
  algorithmVersion: number;
  activeTracks: number;
  readyTracks: number;
  staleTracks: number;
  orphanedFeatures: number;
  orphanedConfirmedMembers: number;
  healthy: boolean;
};

export type ConfirmedAudioSimilarityGroup = {
  id: string;
  relationshipType: AudioSimilarityRelationshipType;
  preferredTrackId: string | null;
  trackIds: string[];
  updatedAt: string;
};

export type AudioSimilarityStatus = {
  state: "idle" | AudioSimilarityRunStatus;
  runId: string | null;
  totalTracks: number;
  processedTracks: number;
  failedTracks: number;
  candidatePairs: number;
  matchingPairs: number;
  comparisonPairsProcessed: number;
  comparisonPairsTotal: number;
  staleTracks: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

export type GenerateAudioSimilarityOptions = {
  fullRebuild?: boolean;
};
