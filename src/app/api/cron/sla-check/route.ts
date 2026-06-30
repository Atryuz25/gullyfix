import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

export async function GET() {
  console.log("[escalateStaleIssues] Starting escalation check...");

  try {
    const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    const staleSnap = await adminDb
      .collection("issues")
      .where("status", "==", "open")
      .where("createdAt", "<=", sevenDaysAgo)
      .get();

    if (staleSnap.empty) {
      return NextResponse.json({ message: "No stale issues found." });
    }

    const wardStaleCounts: Record<string, number> = {};
    const batch = adminDb.batch();
    let escalated = 0;

    for (const issueDoc of staleSnap.docs) {
      const data = issueDoc.data();
      const currentPriority = data.priorityScore || 50;
      const newPriority = Math.min(100, currentPriority + 10);

      batch.update(issueDoc.ref, {
        priorityScore: newPriority,
        lastEscalatedAt: FieldValue.serverTimestamp(),
      });

      wardStaleCounts[data.wardId] = (wardStaleCounts[data.wardId] || 0) + 1;
      escalated++;
    }

    for (const [wardId, count] of Object.entries(wardStaleCounts)) {
      if (count >= 5) {
        batch.update(adminDb.collection("wards").doc(wardId), {
          urgencyLevel: "critical",
          lastEscalationAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();
    return NextResponse.json({ success: true, escalated, wardsAffected: Object.keys(wardStaleCounts).length });
  } catch (err: any) {
    console.error("[escalateStaleIssues] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
