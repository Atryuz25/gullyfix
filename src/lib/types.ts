import { Timestamp, GeoPoint } from "firebase/firestore";

// ─── Issue ───────────────────────────────────────────────────────────────────

export type IssueStatus =
  | "pending_triage"
  | "open"
  | "in_progress"
  | "resolved"
  | "merged"
  | "pending_review"
  | "pending_verification"
  | "disputed";

export type IssueCategory =
  | "road_damage"
  | "water_leakage"
  | "waste"
  | "streetlight"
  | "uncategorized";

export interface Issue {
  id: string;
  status: IssueStatus;
  category: IssueCategory;
  priorityScore: number; // 0–100
  department: string;
  description: string;
  aiReasoning: string; // Gemini's full reasoning — shown in SCR-07/SCR-11
  aiConfidence: number; // 0–1
  visionLabels: string[];
  photoURL: string;
  photoAltText: string; // AI-generated, for accessibility
  location: GeoPoint;
  address: string;
  city?: string;
  ward: string; // e.g. "Ward 3"
  wardId: string; // e.g. "ward_3"
  verifyCount: number;
  verifiedBy: string[]; // array of UIDs — prevents double-verify
  reportedBy: string; // UID
  reporterName: string;
  mergedIntoId: string | null;
  resolutionSteps: string[];      // Gemini-generated action plan for the dept.
  flagCount: number;              // spam/invalid flags from citizens
  flaggedBy: string[];            // UIDs who flagged — prevents double-flag
  lastFlagReason: string;
  triageAttempts: number;         // retry count for recovery loop
  lastTriageAttempt: Timestamp | null;
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
  updatedAt?: Timestamp | null;
  
  // Accountability / Tier 1-3 Features
  resolutionPhotoUrl?: string | null;
  disputePhotoUrl?: string | null;
  disputeReasoning?: string;
  disputeCount?: number;
  slaBreached?: boolean;
  escalationLevel?: number;
  slaDeadline?: Timestamp;
  jurisdictionDisputed?: boolean;

  // Equity Engine
  equityMultiplier?: number;
  equityTier?: number;
  equityLabel?: string;
  basePriority?: number;
  equityTrace?: string;

  // Corridor Multiplexer  
  corridorDetected?: boolean;
  corridorPlaceName?: string | null;
  corridorPlaceType?: string | null;
  corridorDistanceMeters?: number | null;
  slaMultiplier?: number;

  // Department Blacklist
  departmentReputationImpact?: number;
  departmentNewScore?: number;
  departmentBlacklisted?: boolean;

  // Verification Decay
  quarantineFlags?: number;
  quarantineStatus?: 'clean' | 'flagged' | 'cleared';
  quarantineReason?: string;
}

// ─── User (private — auth-gated) ─────────────────────────────────────────────

export interface UserPrivate {
  uid: string;
  isAdmin: boolean;
  wardId: string;
  wardName: string;
  badges: string[];
  lastVerifyAt: Timestamp | null; // rate limiting: 60s cooldown
  onboardingStatus: string[];
  currentMission: string | null;  // issueId of active mission
  createdAt: Timestamp;
}

// ─── Public Profile (globally readable — no PII) ─────────────────────────────

export interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  xpPoints: number;       // canonical XP field — always use this
  level: number;          // computed: Math.floor(xpPoints / 150) + 1
  reportCount: number;    // alias: reportsCount (onboarding writes reportsCount)
  reportsCount: number;
  verifyCount: number;
  resolvedCount: number;  // how many of their reports got resolved
  wardId: string;
  wardName?: string;
  badges: string[];
  currentMission?: string | null; // mirrors UserPrivate.currentMission for fast reads
}

// ─── Prediction ──────────────────────────────────────────────────────────────

export interface Prediction {
  id: string;
  wardId: string;
  ward: string;
  zone: string;
  category: IssueCategory;
  probability: number; // 0–1
  confidenceLabel: string; // e.g. "78% probability"
  reasoning: string;
  basedOnIssueCount: number;
  timeWindowDays: number;
  location: GeoPoint;
  generatedAt: Timestamp;
  status: "active" | "expired";
}

// ─── Ward Health Score ──────────────────────────────────────────────────────

export interface Ward {
  wardId: string;
  ward: string;
  healthScore: number;         // 0–100, computed by Gemini
  healthReasoning: string;     // 1-line Gemini advisory
  topIssueCategory: IssueCategory;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  openIssueCount: number;
  inProgressCount: number;
  resolvedIssueCount: number;
  totalIssueCount: number;
  avgResolutionDays: number;
  avgPriority: number;
  categoryBreakdown: Record<string, number>;
  lastComputedAt: Timestamp;
  
  // Accountability / Tier 1-3 Features
  disputeRate?: number; // % of resolutions passing without dispute
  slaBreachCount?: number;
}

// ─── Triage Agent Response ───────────────────────────────────────────────────

export interface TriageAgentResponse {
  decision: "new" | "merge";
  mergeTargetId: string | null;
  category: IssueCategory;
  priorityScore: number;
  department: string;
  aiReasoning: string;
  aiConfidence: number;
  photoAltText: string;
  resolutionSteps: string[];   // Gemini action plan for the department
}

// ─── Nearby Issue (passed to Gemini — strict metadata only) ──────────────────

export interface NearbyIssueMeta {
  id: string;
  category: IssueCategory;
  priorityScore: number;
  distanceMeters: number;
  verifyCount: number;
}

// ─── Toast notification ───────────────────────────────────────────────────────

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  xp?: number; // if set, shows "+X XP" alongside message
}

// ─── Department ───────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  city: string;
  reputationScore: number;
  ghostResolutionCount: number;
  slaBreachCount: number;
  totalResolved: number;
  blacklisted: boolean;
  blacklistedUntil: Timestamp | null;
  lastUpdated: Timestamp;
}
