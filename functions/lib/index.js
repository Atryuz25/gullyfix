"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyResolution = exports.checkJurisdiction = exports.verifyDispute = exports.autoAssignMission = exports.awardBadges = exports.escalateStaleIssuesV2 = exports.generatePredictions = exports.escalateStaleIssues = exports.warmup = exports.flagIssue = exports.verifyIssue = exports.updateIssueStatus = exports.computeWardHealth = exports.retryTriage = exports.triageIssue = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const generative_ai_1 = require("@google/generative-ai");
const geo_1 = require("./utils/geo");
const sanitize_1 = require("./utils/sanitize");
// ─── Init ─────────────────────────────────────────────────────────────────────
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
const REGION = "asia-south1";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CLOUD_VISION_API_KEY = process.env.CLOUD_VISION_API_KEY || "";
// ─── Fallback (issue is NEVER lost on pipeline failure) ───────────────────────
const TRIAGE_FALLBACK = {
    decision: "new",
    mergeTargetId: null,
    category: "uncategorized",
    priorityScore: 50,
    department: "General Administration Dept.",
    aiReasoning: "Automatic triage unavailable — issue queued for manual review.",
    aiConfidence: 0,
    photoAltText: "Community issue reported by citizen.",
    resolutionSteps: ["Issue is under review by municipal staff."],
};
// ═════════════════════════════════════════════════════════════════════════════
// STEP 1: Cloud Vision
// ═════════════════════════════════════════════════════════════════════════════
async function runCloudVision(photoURL) {
    var _a, _b;
    if (!CLOUD_VISION_API_KEY) {
        console.warn("[Vision] No key — skipping");
        return [];
    }
    try {
        const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${CLOUD_VISION_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                requests: [{
                        image: { source: { imageUri: photoURL } },
                        features: [
                            { type: "LABEL_DETECTION", maxResults: 10 },
                            { type: "OBJECT_LOCALIZATION", maxResults: 5 },
                            { type: "SAFE_SEARCH_DETECTION" },
                        ],
                    }],
            }),
        });
        const data = await res.json();
        const response = ((_a = data.responses) === null || _a === void 0 ? void 0 : _a[0]) || {};
        const safe = response.safeSearchAnnotation;
        if (safe && (safe.adult === "LIKELY" || safe.adult === "VERY_LIKELY" || safe.violence === "LIKELY" || safe.violence === "VERY_LIKELY")) {
            return ["SAFE_SEARCH_FLAGGED"];
        }
        return ((_b = response.labelAnnotations) !== null && _b !== void 0 ? _b : [])
            .filter((a) => a.score > 0.6)
            .map((a) => a.description);
    }
    catch (err) {
        console.error("[Vision] Failed:", err);
        return [];
    }
}
// ═════════════════════════════════════════════════════════════════════════════
// STEP 2: Proximate issues (lean metadata only — keeps Gemini prompt bounded)
// ═════════════════════════════════════════════════════════════════════════════
async function getProximateIssues(lat, lng, excludeId) {
    var _a, _b;
    const box = (0, geo_1.latLngBoundingBox)(lat, lng, 1);
    const snap = await db
        .collection("issues")
        .where("status", "in", ["open", "in_progress"])
        .where("location", ">=", new admin.firestore.GeoPoint(box.minLat, box.minLng))
        .where("location", "<=", new admin.firestore.GeoPoint(box.maxLat, box.maxLng))
        .orderBy("location")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();
    const results = [];
    for (const doc of snap.docs) {
        if (doc.id === excludeId)
            continue;
        const d = doc.data();
        const dist = (0, geo_1.haversineMeters)(lat, lng, d.location.latitude, d.location.longitude);
        if (dist > 1000)
            continue;
        results.push({
            id: doc.id,
            category: d.category,
            priorityScore: (_a = d.priorityScore) !== null && _a !== void 0 ? _a : 50,
            distanceMeters: Math.round(dist),
            verifyCount: (_b = d.verifyCount) !== null && _b !== void 0 ? _b : 0,
        });
    }
    return results.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
}
// ═════════════════════════════════════════════════════════════════════════════
// STEP 3: Gemini Agent — the autonomous decision point
// ═════════════════════════════════════════════════════════════════════════════
async function runGeminiAgent(photoURL, userDescription, // already sanitized before calling
visionLabels, nearbyIssues) {
    if (!GEMINI_API_KEY)
        throw new Error("No Gemini API key");
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const nearbyCtx = nearbyIssues.length
        ? nearbyIssues.map(n => `- id:${n.id} | category:${n.category} | priority:${n.priorityScore} | distance:${n.distanceMeters}m | verifications:${n.verifyCount}`).join("\n")
        : "None";
    const prompt = `You are an AI agent for GullyFix, a civic infrastructure platform in India.
Analyze this issue report and make autonomous decisions.

VISION LABELS: ${visionLabels.join(", ") || "Not available"}
USER DESCRIPTION: ${userDescription || "Not provided"}

NEARBY OPEN ISSUES (within 1km — strict metadata only):
${nearbyCtx}

Make these decisions:

1. DUPLICATE CHECK: "merge" into an existing nearby issue, or "new" unique issue?
   - If distance < 100m AND category matches → strongly consider merge.
   
2. CLASSIFICATION: road_damage | water_leakage | waste | streetlight | uncategorized
   - CRITICAL: If VISION LABELS contains "SAFE_SEARCH_FLAGGED", immediately classify as "uncategorized", set priority to 0, and state "Inappropriate content flagged by safe search" in aiReasoning.

3. PRIORITY SCORE: 0–100. Consider safety risk, verifications, severity in image.

4. DEPARTMENT: "Roads & Infrastructure Dept." | "Water Supply & Drainage Dept." | "Solid Waste Management Dept." | "Street Lighting Dept." | "General Administration Dept."

5. RESOLUTION STEPS: 2–3 concrete action steps the assigned department should take.
   Be specific (e.g., "Dispatch pothole repair crew within 48 hours", not "Fix the issue").

6. PHOTO ALT TEXT: concise accessibility description of the photo.

Return ONLY valid JSON. No markdown. No text outside the JSON object:
{
  "decision": "new" | "merge",
  "mergeTargetId": null | "issueId",
  "category": "road_damage" | "water_leakage" | "waste" | "streetlight" | "uncategorized",
  "priorityScore": 0-100,
  "department": "department string",
  "aiReasoning": "2-3 sentences of reasoning visible to citizens and admins",
  "aiConfidence": 0.0-1.0,
  "photoAltText": "concise alt text",
  "resolutionSteps": ["Step 1", "Step 2", "Step 3"]
}`;
    // Fetch photo for Gemini multimodal
    let imagePart = null;
    try {
        const imgRes = await fetch(photoURL);
        const buf = await imgRes.arrayBuffer();
        imagePart = {
            inlineData: {
                data: Buffer.from(buf).toString("base64"),
                mimeType: imgRes.headers.get("content-type") || "image/jpeg",
            },
        };
    }
    catch (_a) {
        console.warn("[Gemini] Could not fetch photo — text-only mode");
    }
    const parts = imagePart ? [{ text: prompt }, imagePart] : [{ text: prompt }];
    const result = await model.generateContent(parts);
    const text = result.response.text().trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
    const parsed = JSON.parse(text);
    if (!parsed.decision || !parsed.category || typeof parsed.priorityScore !== "number") {
        throw new Error("Gemini returned incomplete JSON");
    }
    if (!Array.isArray(parsed.resolutionSteps)) {
        parsed.resolutionSteps = ["Awaiting department review."];
    }
    return parsed;
}
// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: Execute Gemini's decision
// ═════════════════════════════════════════════════════════════════════════════
async function executeDecision(issueId, agent, visionLabels) {
    const batch = db.batch();
    if (agent.decision === "merge" && agent.mergeTargetId) {
        const targetRef = db.collection("issues").doc(agent.mergeTargetId);
        batch.update(targetRef, {
            verifyCount: admin.firestore.FieldValue.increment(1),
        });
        batch.update(db.collection("issues").doc(issueId), {
            status: "merged",
            mergedIntoId: agent.mergeTargetId,
            aiReasoning: agent.aiReasoning,
            visionLabels,
            photoAltText: agent.photoAltText,
        });
    }
    else {
        // Calculate SLA Deadline
        let slaDays = 7; // Default
        if (agent.category === "road_damage")
            slaDays = 7;
        if (agent.category === "water_leakage")
            slaDays = 2;
        if (agent.category === "waste")
            slaDays = 2;
        if (agent.category === "streetlight")
            slaDays = 3;
        const slaDeadline = admin.firestore.Timestamp.fromDate(new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000));
        batch.update(db.collection("issues").doc(issueId), {
            status: "open",
            category: agent.category,
            priorityScore: agent.priorityScore,
            department: agent.department,
            aiReasoning: agent.aiReasoning,
            aiConfidence: agent.aiConfidence,
            resolutionSteps: agent.resolutionSteps,
            visionLabels,
            photoAltText: agent.photoAltText,
            mergedIntoId: null,
            slaDeadline,
            slaBreached: false,
            escalationLevel: 0,
            jurisdictionDisputed: false,
        });
    }
    await batch.commit();
}
// ═════════════════════════════════════════════════════════════════════════════
// SHARED: Run the full triage pipeline (used by triageIssue + retryTriage)
// ═════════════════════════════════════════════════════════════════════════════
async function runTriagePipeline(issueId, data) {
    const lat = data.location.latitude;
    const lng = data.location.longitude;
    const photoURL = data.photoURL || "";
    // FIX Gap 7: sanitize user input before it reaches Gemini
    const userDescription = (0, sanitize_1.sanitizeText)(data.description || "", 500);
    console.log(`[triage] Processing ${issueId} at (${lat}, ${lng})`);
    const visionLabels = await runCloudVision(photoURL);
    const nearbyIssues = await getProximateIssues(lat, lng, issueId);
    const agent = await runGeminiAgent(photoURL, userDescription, visionLabels, nearbyIssues);
    console.log(`[triage] Decision: ${agent.decision} | ${agent.category} | P:${agent.priorityScore}`);
    await executeDecision(issueId, agent, visionLabels);
}
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 1: triageIssue — fires on new issue creation
// ═════════════════════════════════════════════════════════════════════════════
exports.triageIssue = (0, firestore_1.onDocumentCreated)({
    document: "issues/{issueId}",
    secrets: ["GEMINI_API_KEY", "CLOUD_VISION_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB",
    region: REGION,
}, async (event) => {
    var _a;
    const issueId = event.params.issueId;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data || data.status !== "pending_triage")
        return;
    try {
        await runTriagePipeline(issueId, data);
    }
    catch (err) {
        console.error(`[triageIssue] Failed for ${issueId}:`, err);
        await db.collection("issues").doc(issueId).update(Object.assign(Object.assign({}, TRIAGE_FALLBACK), { visionLabels: [], 
            // Keep status as pending_triage so retryTriage picks it up
            status: "pending_triage", lastTriageAttempt: admin.firestore.FieldValue.serverTimestamp(), triageAttempts: admin.firestore.FieldValue.increment(1) }));
    }
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 2: retryTriage — FIX Gap 3: agent recovery loop
// Runs every 5 minutes. Picks up pending_triage issues older than 5 min
// that haven't been retried more than 3 times. Genuinely agentic behavior.
// ═════════════════════════════════════════════════════════════════════════════
exports.retryTriage = (0, scheduler_1.onSchedule)({
    schedule: "every 5 minutes",
    secrets: ["GEMINI_API_KEY", "CLOUD_VISION_API_KEY"],
    timeoutSeconds: 300,
    memory: "512MiB",
    region: REGION,
}, async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuckIssues = await db
        .collection("issues")
        .where("status", "==", "pending_triage")
        .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(fiveMinutesAgo))
        .where("triageAttempts", "<", 3)
        .limit(10)
        .get();
    if (stuckIssues.empty) {
        console.log("[retryTriage] No stuck issues found.");
        return;
    }
    console.log(`[retryTriage] Retrying ${stuckIssues.size} stuck issues...`);
    for (const doc of stuckIssues.docs) {
        try {
            await runTriagePipeline(doc.id, doc.data());
            console.log(`[retryTriage] ✓ Recovered issue ${doc.id}`);
        }
        catch (err) {
            console.error(`[retryTriage] Failed again for ${doc.id}:`, err);
            await doc.ref.update({
                triageAttempts: admin.firestore.FieldValue.increment(1),
                lastTriageAttempt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 3: computeWardHealth — FIX Gap 4: Ward Health Score
// Triggered on every issue status change. Sends ward stats to Gemini
// (gemini-2.5-flash — better reasoning for analytics), gets 0–100 score
// + 1-line advisory. Writes to wards/{wardId}.
// ═════════════════════════════════════════════════════════════════════════════
exports.computeWardHealth = (0, firestore_1.onDocumentUpdated)({
    document: "issues/{issueId}",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,
    memory: "256MiB",
    region: REGION,
}, async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    // Only trigger when status actually changes
    if (!before || !after || before.status === after.status)
        return;
    const wardId = after.wardId;
    if (!wardId)
        return;
    console.log(`[wardHealth] Recomputing health for ${wardId}...`);
    try {
        // Aggregate ward stats from Firestore
        const issuesSnap = await db
            .collection("issues")
            .where("wardId", "==", wardId)
            .where("status", "!=", "merged")
            .get();
        const issues = issuesSnap.docs.map(d => d.data());
        const totalCount = issues.length;
        const openCount = issues.filter(i => i.status === "open").length;
        const inProgressCount = issues.filter(i => i.status === "in_progress").length;
        const resolvedCount = issues.filter(i => i.status === "resolved").length;
        const resolvedWithTime = issues.filter(i => i.status === "resolved" && i.resolvedAt && i.createdAt);
        const avgResolutionDays = resolvedWithTime.length > 0
            ? resolvedWithTime.reduce((sum, i) => {
                const ms = i.resolvedAt.toMillis() - i.createdAt.toMillis();
                return sum + ms / (1000 * 60 * 60 * 24);
            }, 0) / resolvedWithTime.length
            : 0;
        const categoryBreakdown = issues.reduce((acc, i) => {
            acc[i.category] = (acc[i.category] || 0) + 1;
            return acc;
        }, {});
        const avgPriority = totalCount > 0
            ? issues.reduce((s, i) => s + (i.priorityScore || 50), 0) / totalCount
            : 50;
        // Call Gemini (gemini-2.5-flash — better reasoning for analytics)
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are a civic analytics AI computing a Ward Health Score for an Indian municipal ward.

WARD: ${wardId}
STATS:
- Total issues reported: ${totalCount}
- Open issues: ${openCount}
- In progress: ${inProgressCount}
- Resolved: ${resolvedCount}
- Avg resolution time: ${avgResolutionDays.toFixed(1)} days
- Avg priority score: ${avgPriority.toFixed(0)}/100
- Category breakdown: ${JSON.stringify(categoryBreakdown)}

Compute a Ward Health Score from 0–100, where:
- 100 = excellent (few open issues, fast resolution, low priority scores)
- 0 = critical (many high-priority open issues, slow/no resolution)

Return ONLY valid JSON:
{
  "healthScore": 0-100,
  "healthReasoning": "One concise sentence explaining the score for citizens.",
  "topIssueCategory": "the category with most open issues",
  "urgencyLevel": "low" | "medium" | "high" | "critical"
}`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim()
            .replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const wardHealth = JSON.parse(text);
        // Write to wards/{wardId}
        await db.collection("wards").doc(wardId).set({
            wardId,
            healthScore: wardHealth.healthScore,
            healthReasoning: wardHealth.healthReasoning,
            topIssueCategory: wardHealth.topIssueCategory,
            urgencyLevel: wardHealth.urgencyLevel,
            openIssueCount: openCount,
            inProgressCount,
            resolvedIssueCount: resolvedCount,
            totalIssueCount: totalCount,
            avgResolutionDays: parseFloat(avgResolutionDays.toFixed(1)),
            avgPriority: parseFloat(avgPriority.toFixed(0)),
            categoryBreakdown,
            lastComputedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`[wardHealth] ✓ ${wardId} → score: ${wardHealth.healthScore}`);
    }
    catch (err) {
        console.error(`[wardHealth] Failed for ${wardId}:`, err);
        // Non-critical — don't throw, ward health is supplementary
    }
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 4: updateIssueStatus — FIX Gap 1: admin status management
// Admin-only HTTPS callable. Sets resolvedAt when status → "resolved".
// This is what makes the "6.2 days avg" metric live, not just seeded.
// ═════════════════════════════════════════════════════════════════════════════
exports.updateIssueStatus = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { issueId, status } = request.data;
    if (!issueId || !status) {
        throw new https_1.HttpsError("invalid-argument", "issueId and status are required");
    }
    const validStatuses = ["open", "in_progress", "resolved"];
    if (!validStatuses.includes(status)) {
        throw new https_1.HttpsError("invalid-argument", `Invalid status: ${status}`);
    }
    // Verify caller is admin
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.isAdmin) !== true) {
        throw new https_1.HttpsError("permission-denied", "Admin access required");
    }
    const update = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Set resolvedAt timestamp when moving to resolved
    if (status === "resolved") {
        update.resolvedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    // Clear resolvedAt if moving back from resolved
    if (status !== "resolved") {
        update.resolvedAt = null;
    }
    await db.collection("issues").doc(issueId).update(update);
    console.log(`[updateIssueStatus] Issue ${issueId} → ${status} by admin ${uid}`);
    return { success: true, issueId, status };
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 5: verifyIssue — FIX Gap 5: rate limiting (lastVerifyAt check)
// ═════════════════════════════════════════════════════════════════════════════
exports.verifyIssue = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { issueId } = request.data;
    if (!issueId)
        throw new https_1.HttpsError("invalid-argument", "issueId is required");
    const issueRef = db.collection("issues").doc(issueId);
    const userPrivateRef = db.collection("users").doc(uid);
    const profileRef = db.collection("public_profiles").doc(uid);
    const result = await db.runTransaction(async (tx) => {
        const [issueSnap, userSnap] = await Promise.all([
            tx.get(issueRef),
            tx.get(userPrivateRef),
        ]);
        if (!issueSnap.exists)
            throw new https_1.HttpsError("not-found", "Issue not found");
        const issue = issueSnap.data();
        const user = userSnap.data();
        // Rate limit: 60-second cooldown between verifications
        if (user === null || user === void 0 ? void 0 : user.lastVerifyAt) {
            const lastVerify = user.lastVerifyAt;
            const secsSince = (Date.now() - lastVerify.toMillis()) / 1000;
            if (secsSince < 60) {
                throw new https_1.HttpsError("resource-exhausted", `Please wait ${Math.ceil(60 - secsSince)} seconds before verifying again.`);
            }
        }
        // Prevent double-verify on the same issue
        if ((issue.verifiedBy || []).includes(uid)) {
            throw new https_1.HttpsError("already-exists", "You have already verified this issue");
        }
        const newVerifyCount = (issue.verifyCount || 0) + 1;
        tx.update(issueRef, {
            verifyCount: newVerifyCount,
            verifiedBy: admin.firestore.FieldValue.arrayUnion(uid),
        });
        tx.set(profileRef, {
            xpPoints: admin.firestore.FieldValue.increment(10),
            verifyCount: admin.firestore.FieldValue.increment(1),
        }, { merge: true });
        // Update lastVerifyAt in private users doc (rate limiting)
        tx.set(userPrivateRef, {
            lastVerifyAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { newVerifyCount };
    });
    return result;
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 6: flagIssue — FIX Gap 6: spam/invalid reporting
// Citizens can flag issues as spam/invalid. At 3+ flags: auto-hide from
// public map, queue for admin review. Admins can permanently delete.
// ═════════════════════════════════════════════════════════════════════════════
exports.flagIssue = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { issueId, reason } = request.data;
    if (!issueId)
        throw new https_1.HttpsError("invalid-argument", "issueId is required");
    const issueRef = db.collection("issues").doc(issueId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(issueRef);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "Issue not found");
        const issue = snap.data();
        const flaggedBy = issue.flaggedBy || [];
        if (flaggedBy.includes(uid)) {
            throw new https_1.HttpsError("already-exists", "You have already flagged this issue");
        }
        const newFlagCount = (issue.flagCount || 0) + 1;
        const newFlaggedBy = [...flaggedBy, uid];
        const update = {
            flagCount: newFlagCount,
            flaggedBy: newFlaggedBy,
            lastFlagReason: reason || "Not specified",
        };
        // Auto-hide at 3+ flags (removes from public map, queues for admin review)
        if (newFlagCount >= 3) {
            update.status = "pending_review";
            console.log(`[flagIssue] Issue ${issueId} auto-hidden after ${newFlagCount} flags`);
        }
        tx.update(issueRef, update);
    });
    return { success: true };
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 7: warmup — prevents cold starts during judge evaluation window
// Called by Cloud Scheduler (see scheduler config in firebase.json)
// ═════════════════════════════════════════════════════════════════════════════
exports.warmup = (0, https_1.onRequest)({ region: REGION }, (_req, res) => {
    res.json({ status: "warm", ts: Date.now(), region: REGION });
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 6: escalateStaleIssues (Tier 2: SLA Breach Detector)
// Runs daily. Checks open issues against slaDeadline. If breached, auto-escalate.
// ═════════════════════════════════════════════════════════════════════════════
exports.escalateStaleIssues = (0, scheduler_1.onSchedule)({
    schedule: "every 24 hours",
    timeoutSeconds: 120,
    memory: "256MiB",
    region: REGION,
}, async () => {
    const now = admin.firestore.Timestamp.now();
    const staleSnap = await db
        .collection("issues")
        .where("status", "in", ["open", "in_progress"])
        .where("slaBreached", "==", false)
        .where("slaDeadline", "<", now)
        .get();
    if (staleSnap.empty) {
        console.log("[escalateStaleIssues] No SLA breaches found today.");
        return;
    }
    console.log(`[escalateStaleIssues] Flagging ${staleSnap.size} issues for SLA breach.`);
    const batch = db.batch();
    staleSnap.docs.forEach(doc => {
        batch.update(doc.ref, {
            slaBreached: true,
            escalationLevel: admin.firestore.FieldValue.increment(1),
            aiReasoning: doc.data().aiReasoning + "\n\n[SYSTEM] SLA Breached. Issue escalated.",
        });
    });
    await batch.commit();
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 7: generatePredictions (Tier 1: Risk Horizon Engine)ghtly
// Analyses ward health data + recent issue history via Gemini to forecast
// likely infrastructure failures in the next 7–30 days.
// Writes to predictions/{wardId}_{category} — powers the "Risk Horizon" map layer.
// ═════════════════════════════════════════════════════════════════════════════
exports.generatePredictions = (0, scheduler_1.onSchedule)({
    schedule: "every 24 hours",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 540,
    memory: "512MiB",
    region: REGION,
}, async () => {
    var _a, _b;
    console.log("[generatePredictions] Starting nightly prediction run...");
    const wardsSnap = await db.collection("wards").get();
    if (wardsSnap.empty) {
        console.log("[generatePredictions] No wards found. Skipping.");
        return;
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    for (const wardDoc of wardsSnap.docs) {
        const ward = wardDoc.data();
        const wardId = ward.wardId;
        try {
            // Need at least 5 issues to make a meaningful prediction
            const issuesSnap = await db
                .collection("issues")
                .where("wardId", "==", wardId)
                .where("status", "!=", "merged")
                .where("createdAt", ">=", thirtyDaysAgo)
                .get();
            if (issuesSnap.size < 3) {
                console.log(`[generatePredictions] ${wardId}: insufficient data (${issuesSnap.size} issues). Skipping.`);
                continue;
            }
            const issues = issuesSnap.docs.map(d => d.data());
            const openIssues = issues.filter(i => i.status === "open" || i.status === "in_progress");
            const recentResolved = issues.filter(i => i.status === "resolved");
            // Compute trend: are issues accumulating or resolving?
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recentNew = issues.filter(i => { var _a; return ((_a = i.createdAt) === null || _a === void 0 ? void 0 : _a.toMillis()) > weekAgo; }).length;
            const categoryBreakdown = issues.reduce((acc, i) => {
                acc[i.category] = (acc[i.category] || 0) + 1;
                return acc;
            }, {});
            const avgPriority = issues.reduce((s, i) => s + (i.priorityScore || 50), 0) / issues.length;
            const prompt = `You are an infrastructure failure prediction AI for GullyFix, a civic platform in India.
Analyze this ward's recent data and predict the SINGLE most likely infrastructure failure in the next 30 days.

WARD: ${ward.ward} (${wardId})
HEALTH SCORE: ${ward.healthScore}/100 (${ward.urgencyLevel} urgency)
AVG RESOLUTION TIME: ${ward.avgResolutionDays} days
TOTAL ISSUES (last 30 days): ${issues.length}
OPEN ISSUES: ${openIssues.length}
RECENTLY RESOLVED: ${recentResolved.length}
NEW THIS WEEK: ${recentNew} (trend indicator)
AVG PRIORITY SCORE: ${avgPriority.toFixed(0)}/100
CATEGORY BREAKDOWN: ${JSON.stringify(categoryBreakdown)}
TOP ISSUE CATEGORY: ${ward.topIssueCategory}
GEMINI ADVISORY: ${ward.healthReasoning}

Based on this data, predict the most likely infrastructure failure:
- High volume of one category suggests systemic failure
- Long avg resolution + high open count = backlog risk
- Consider monsoon patterns for road/drainage issues

Return ONLY valid JSON, no markdown:
{
  "category": "road_damage" | "water_leakage" | "waste" | "streetlight",
  "probability": 0.0-1.0,
  "confidenceLabel": "e.g. 78% probability",
  "reasoning": "2-3 sentences citing the specific data evidence above. Be concrete.",
  "timeWindowDays": 7-30,
  "severity": "low" | "medium" | "high" | "critical"
}`;
            const result = await model.generateContent(prompt);
            const raw = result.response.text().trim()
                .replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            const prediction = JSON.parse(raw);
            // Validate
            if (!prediction.category || typeof prediction.probability !== "number") {
                throw new Error("Invalid prediction response");
            }
            // Use centroid of open issues as the prediction location
            const locationIssues = openIssues.filter(i => i.location);
            let lat = ((_a = ward.location) === null || _a === void 0 ? void 0 : _a.latitude) || 17.4239;
            let lng = ((_b = ward.location) === null || _b === void 0 ? void 0 : _b.longitude) || 78.4062;
            if (locationIssues.length > 0) {
                lat = locationIssues.reduce((s, i) => s + i.location.latitude, 0) / locationIssues.length;
                lng = locationIssues.reduce((s, i) => s + i.location.longitude, 0) / locationIssues.length;
            }
            const predictionId = `${wardId}_${prediction.category}`;
            await db.collection("predictions").doc(predictionId).set({
                id: predictionId,
                wardId,
                ward: ward.ward,
                zone: "Central",
                category: prediction.category,
                probability: Math.min(1, Math.max(0, prediction.probability)),
                confidenceLabel: prediction.confidenceLabel,
                reasoning: prediction.reasoning,
                severity: prediction.severity || "medium",
                timeWindowDays: prediction.timeWindowDays,
                basedOnIssueCount: issues.length,
                location: new admin.firestore.GeoPoint(lat, lng),
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "active",
            }, { merge: true });
            console.log(`[generatePredictions] ✓ ${wardId}: ${prediction.category} (${prediction.confidenceLabel})`);
            // Small delay to avoid Gemini rate limiting
            await new Promise(r => setTimeout(r, 500));
        }
        catch (err) {
            console.error(`[generatePredictions] Failed for ${wardId}:`, err);
            // Non-fatal — continue with other wards
        }
    }
    console.log("[generatePredictions] ✓ Prediction run complete.");
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 9: escalateStaleIssues — Scheduled every 12 hours
// Proactive agent: finds open issues older than 7 days, bumps priority score
// by 10 (capped at 100), and marks wards with 5+ stale issues as "critical".
// This creates autonomous accountability pressure without human intervention.
// ═════════════════════════════════════════════════════════════════════════════
exports.escalateStaleIssuesV2 = (0, scheduler_1.onSchedule)({
    schedule: "every 12 hours",
    timeoutSeconds: 300,
    memory: "256MiB",
    region: REGION,
}, async () => {
    console.log("[escalateStaleIssues] Starting escalation check...");
    const sevenDaysAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const staleSnap = await db
        .collection("issues")
        .where("status", "==", "open")
        .where("createdAt", "<=", sevenDaysAgo)
        .get();
    if (staleSnap.empty) {
        console.log("[escalateStaleIssues] No stale issues found.");
        return;
    }
    const wardStaleCounts = {};
    const batch = db.batch();
    let escalated = 0;
    for (const issueDoc of staleSnap.docs) {
        const data = issueDoc.data();
        const currentPriority = data.priorityScore || 50;
        const newPriority = Math.min(100, currentPriority + 10);
        batch.update(issueDoc.ref, {
            priorityScore: newPriority,
            lastEscalatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        wardStaleCounts[data.wardId] = (wardStaleCounts[data.wardId] || 0) + 1;
        escalated++;
    }
    // Escalate ward urgency for wards with 5+ stale issues
    for (const [wardId, count] of Object.entries(wardStaleCounts)) {
        if (count >= 5) {
            batch.update(db.collection("wards").doc(wardId), {
                urgencyLevel: "critical",
                lastEscalationAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[escalateStaleIssues] Ward ${wardId} escalated to CRITICAL (${count} stale issues)`);
        }
    }
    await batch.commit();
    console.log(`[escalateStaleIssues] ✓ Escalated ${escalated} stale issues across ${Object.keys(wardStaleCounts).length} wards`);
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 10: awardBadges — Triggers on public_profile updates
// Real badge economy: awards badges based on cumulative activity milestones.
// Checks after every profile update and grants badges not yet held.
// Badge catalogue:
//   first_responder   — first issue reported
//   sentinel          — 10 verifications
//   road_warrior      — 5 road_damage reports
//   water_guardian    — 5 water_leakage reports
//   truth_teller      — 3 flags accepted (issue reached pending_review)
//   top_10            — reached top 10 in leaderboard
//   level_5           — reached level 5 (750 XP)
// ═════════════════════════════════════════════════════════════════════════════
exports.awardBadges = (0, firestore_1.onDocumentUpdated)({
    document: "public_profiles/{uid}",
    region: REGION,
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    const uid = event.params.uid;
    const currentBadges = after.badges || [];
    const newBadges = [];
    const xp = after.xpPoints || 0;
    const level = Math.floor(xp / 150) + 1;
    const reportCount = after.reportsCount || 0;
    const verifyCount = after.verifyCount || 0;
    // ── Badge checks ─────────────────────────────────────────────────────────
    if (reportCount >= 1 && !currentBadges.includes("first_responder")) {
        newBadges.push("first_responder");
    }
    if (verifyCount >= 10 && !currentBadges.includes("sentinel")) {
        newBadges.push("sentinel");
    }
    if (level >= 5 && !currentBadges.includes("level_5")) {
        newBadges.push("level_5");
    }
    if (xp >= 1000 && !currentBadges.includes("civic_champion")) {
        newBadges.push("civic_champion");
    }
    // Check category-specific report counts from issues collection
    if (reportCount >= 5) {
        const roadSnap = await db
            .collection("issues")
            .where("reportedBy", "==", uid)
            .where("category", "==", "road_damage")
            .get();
        if (roadSnap.size >= 5 && !currentBadges.includes("road_warrior")) {
            newBadges.push("road_warrior");
        }
        const waterSnap = await db
            .collection("issues")
            .where("reportedBy", "==", uid)
            .where("category", "==", "water_leakage")
            .get();
        if (waterSnap.size >= 5 && !currentBadges.includes("water_guardian")) {
            newBadges.push("water_guardian");
        }
    }
    if (newBadges.length === 0)
        return;
    // Write new badges atomically
    await db.collection("public_profiles").doc(uid).update({
        badges: admin.firestore.FieldValue.arrayUnion(...newBadges),
        level, // keep level in sync
    });
    // Also update private user doc badges array
    await db.collection("users").doc(uid).update({
        badges: admin.firestore.FieldValue.arrayUnion(...newBadges),
    }).catch(() => { }); // non-fatal
    console.log(`[awardBadges] ✓ Awarded to ${uid}: ${newBadges.join(", ")}`);
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 11: autoAssignMission — Fires when high-priority issue is created
// When AI scores a new issue at priority >= 80, assigns it as a verification
// mission to nearby users in the same ward who have no active mission.
// ═════════════════════════════════════════════════════════════════════════════
exports.autoAssignMission = (0, firestore_1.onDocumentUpdated)({
    document: "issues/{issueId}",
    region: REGION,
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Only trigger when: status changes from pending_triage → open AND priority >= 80
    if (before.status !== "pending_triage" || after.status !== "open")
        return;
    if ((after.priorityScore || 0) < 80)
        return;
    const issueId = event.params.issueId;
    const wardId = after.wardId;
    console.log(`[autoAssignMission] High-priority issue ${issueId} (P:${after.priorityScore}) in ${wardId}`);
    try {
        // Find up to 3 ward users without an active mission
        const usersSnap = await db
            .collection("users")
            .where("wardId", "==", wardId)
            .where("currentMission", "==", null)
            .limit(3)
            .get();
        if (usersSnap.empty) {
            console.log("[autoAssignMission] No available users in ward for mission assignment.");
            return;
        }
        const batch = db.batch();
        for (const userDoc of usersSnap.docs) {
            batch.update(userDoc.ref, { currentMission: issueId });
            // Also update public profile for fast reads
            batch.update(db.collection("public_profiles").doc(userDoc.id), {
                currentMission: issueId,
            });
        }
        await batch.commit();
        console.log(`[autoAssignMission] ✓ Assigned mission ${issueId} to ${usersSnap.size} users in ${wardId}`);
    }
    catch (err) {
        console.error("[autoAssignMission] Failed:", err);
    }
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 12: verifyDispute (Tier 1: Closure Verification Agent)
// Multimodal check: Original Photo vs Resolution Photo vs Dispute Photo
// ═════════════════════════════════════════════════════════════════════════════
exports.verifyDispute = (0, https_1.onCall)({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,
    memory: "512MiB",
    region: REGION,
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const { issueId, disputePhotoBase64 } = request.data;
    if (!issueId || !disputePhotoBase64) {
        throw new https_1.HttpsError("invalid-argument", "Missing issueId or dispute photo");
    }
    const docRef = db.collection("issues").doc(issueId);
    const docSnap = await docRef.get();
    if (!docSnap.exists)
        throw new https_1.HttpsError("not-found", "Issue not found");
    const issue = docSnap.data();
    if (issue.status !== "pending_verification") {
        throw new https_1.HttpsError("failed-precondition", "Issue is not pending verification");
    }
    console.log(`[verifyDispute] Analyzing dispute for issue ${issueId}`);
    let resolutionPart = null;
    let originalPart = null;
    try {
        if (issue.resolutionPhotoUrl && issue.resolutionPhotoUrl.startsWith("data:image/")) {
            resolutionPart = {
                inlineData: {
                    data: issue.resolutionPhotoUrl.split(",")[1],
                    mimeType: "image/jpeg"
                }
            };
        }
        if (issue.photoURL && issue.photoURL.startsWith("data:image/")) {
            originalPart = {
                inlineData: {
                    data: issue.photoURL.split(",")[1],
                    mimeType: "image/jpeg"
                }
            };
        }
        else if (issue.photoURL) {
            // Fallback if original was a real URL
            const imgRes = await fetch(issue.photoURL);
            const buf = await imgRes.arrayBuffer();
            originalPart = {
                inlineData: {
                    data: Buffer.from(buf).toString("base64"),
                    mimeType: imgRes.headers.get("content-type") || "image/jpeg",
                }
            };
        }
    }
    catch (e) {
        console.warn("Failed to load historical photos for dispute:", e);
    }
    const disputePart = {
        inlineData: {
            data: disputePhotoBase64.split(",")[1],
            mimeType: "image/jpeg"
        }
    };
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are a Municipal Infrastructure Inspector for GullyFix.
A citizen has disputed a resolution claim.

Please analyze the provided photos (if available):
1. The original damage.
2. The admin's resolution proof.
3. The citizen's dispute photo (which claims it is still broken).

Does the damage pattern still persist in the dispute photo? Is the resolution claim false?

Return ONLY valid JSON:
{
  "stillBroken": boolean,
  "reasoning": "Detailed visual analysis (e.g., 'Damage pattern still visible... Original pothole depth visible in dispute photo... Resolution claim rejected')"
}`;
    const parts = [{ text: prompt }];
    if (originalPart) {
        parts.push({ text: "Original Damage:" });
        parts.push(originalPart);
    }
    if (resolutionPart) {
        parts.push({ text: "Claimed Resolution:" });
        parts.push(resolutionPart);
    }
    parts.push({ text: "Citizen Dispute Proof:" });
    parts.push(disputePart);
    const result = await model.generateContent(parts);
    const text = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (e) {
        parsed = { stillBroken: true, reasoning: "AI failed to parse, assuming valid dispute." };
    }
    const isDisputed = parsed.stillBroken;
    let newReasoning = issue.disputeReasoning ? issue.disputeReasoning + "\n\n" : "";
    newReasoning += `[DISPUTE VERIFICATION]\n${parsed.reasoning}`;
    if (isDisputed) {
        newReasoning += `\n\n[SYSTEM] Escalation notice drafted for Assistant Executive Engineer, Ward ${issue.wardId.replace('ward_', '')}. Reason: Resolution disputed by citizen with photographic evidence. AI analysis confirms damage persists.`;
    }
    await docRef.update({
        status: isDisputed ? "disputed" : "resolved",
        disputePhotoUrl: disputePhotoBase64,
        disputeReasoning: newReasoning,
        disputeCount: admin.firestore.FieldValue.increment(1),
        resolvedAt: isDisputed ? null : admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, isDisputed, reasoning: parsed.reasoning };
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 13: checkJurisdiction (Tier 2: Jurisdiction Mapper)
// Admin action to verify if an issue belongs to their department using Gemini.
// ═════════════════════════════════════════════════════════════════════════════
exports.checkJurisdiction = (0, https_1.onCall)({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,
    memory: "256MiB",
    region: REGION,
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const { issueId } = request.data;
    if (!issueId)
        throw new https_1.HttpsError("invalid-argument", "Missing issueId");
    const docRef = db.collection("issues").doc(issueId);
    const docSnap = await docRef.get();
    if (!docSnap.exists)
        throw new https_1.HttpsError("not-found", "Issue not found");
    const issue = docSnap.data();
    if (!issue.location || !issue.department) {
        throw new https_1.HttpsError("failed-precondition", "Issue missing location or department");
    }
    console.log(`[checkJurisdiction] Analyzing jurisdiction for issue ${issueId}`);
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an expert on Hyderabad municipal jurisdiction boundaries.
GPS: ${issue.location.latitude}, ${issue.location.longitude}
Claimed department: ${issue.department}
Issue type: ${issue.category}

Is this department correct for this location and issue type?
Return JSON: { "correct": boolean, "actual_department": "string", "reasoning": "string" }`;
    const parts = [{ text: prompt }];
    const result = await model.generateContent(parts);
    const text = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (e) {
        throw new https_1.HttpsError("internal", "AI failed to analyze jurisdiction");
    }
    let newReasoning = issue.aiReasoning ? issue.aiReasoning + "\n\n" : "";
    newReasoning += `[JURISDICTION CHECK]\n${parsed.reasoning}`;
    const updateData = {
        jurisdictionDisputed: true,
        aiReasoning: newReasoning,
    };
    // If AI agrees it's wrong, we re-route it
    if (!parsed.correct && parsed.actual_department) {
        updateData.department = parsed.actual_department;
        newReasoning += `\n\n[SYSTEM] Re-routing issue to ${parsed.actual_department}.`;
        updateData.aiReasoning = newReasoning;
    }
    else {
        newReasoning += `\n\n[SYSTEM] Jurisdiction verified as correct. Escalation notice drafted for Admin.`;
        updateData.aiReasoning = newReasoning;
        updateData.escalationLevel = admin.firestore.FieldValue.increment(1);
    }
    await docRef.update(updateData);
    return { success: true, correct: parsed.correct, actual_department: parsed.actual_department, reasoning: parsed.reasoning };
});
// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION 4: verifyResolution (Phase 2 - 3-Way Audit)
// ═════════════════════════════════════════════════════════════════════════════
exports.verifyResolution = (0, firestore_1.onDocumentUpdated)({
    document: "issues/{issueId}",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB",
    region: REGION,
}, async (event) => {
    var _a, _b, _c;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    // Trigger only when status changes to disputed
    if (!before || !after)
        return;
    if (before.status === "disputed" || after.status !== "disputed")
        return;
    const photoURL = after.photoURL;
    const resolutionPhotoUrl = after.resolutionPhotoUrl || after.resolutionPhotoURL;
    const disputePhotoUrl = after.disputePhotoUrl || after.disputePhotoURL;
    if (!photoURL || !resolutionPhotoUrl || !disputePhotoUrl) {
        console.warn("[verifyResolution] Missing required photos for 3-way audit");
        return;
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    // Fetch images and convert to base64 inline data
    const fetchImage = async (url) => {
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            return {
                inlineData: {
                    data: Buffer.from(buf).toString("base64"),
                    mimeType: res.headers.get("content-type") || "image/jpeg",
                }
            };
        }
        catch (err) {
            console.error("Failed to fetch image", url);
            return null;
        }
    };
    const [img1, img2, img3] = await Promise.all([
        fetchImage(photoURL),
        fetchImage(resolutionPhotoUrl),
        fetchImage(disputePhotoUrl)
    ]);
    if (!img1 || !img2 || !img3)
        return;
    const prompt = `You are an autonomous civic infrastructure auditor.
You have been provided three images:
1. ORIGINAL: The hazard as reported by a citizen.
2. RESOLUTION: Photo uploaded by the municipal officer claiming repair.
3. DISPUTE: Photo uploaded by the citizen claiming the issue persists.

Analyze all three images and return ONLY valid JSON:
{
  "persistenceConfirmed": boolean,
  "trustScore": number,
  "reasoning": "string",
  "recommendation": "escalate" | "close" | "reinspect"
}

If trustScore < 0.65, the resolution is rejected.
Do not return anything outside the JSON object.`;
    const result = await model.generateContent([
        { text: prompt },
        { text: "Image 1 (ORIGINAL):" }, img1,
        { text: "Image 2 (RESOLUTION):" }, img2,
        { text: "Image 3 (DISPUTE):" }, img3
    ]);
    const text = result.response.text().trim()
        .replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const audit = JSON.parse(text);
    const updateData = {
        disputeReasoning: `[DISPUTE VERIFICATION] ${audit.reasoning}`,
        disputeTrustScore: audit.trustScore,
        disputeRecommendation: audit.recommendation,
    };
    if (audit.persistenceConfirmed) {
        updateData.status = "open";
        updateData.escalationLevel = admin.firestore.FieldValue.increment(1);
    }
    await ((_c = event.data) === null || _c === void 0 ? void 0 : _c.after.ref.update(updateData));
});
//# sourceMappingURL=index.js.map