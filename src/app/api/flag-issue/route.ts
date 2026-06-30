import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { userId, issueId, reason } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!issueId) {
      return NextResponse.json({ error: "issueId is required" }, { status: 400 });
    }

    const issueRef = adminDb.collection("issues").doc(issueId);

    const snap = await issueRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const issue = snap.data()!;
    const flaggedBy: string[] = issue.flaggedBy || [];

    if (flaggedBy.includes(userId)) {
      return NextResponse.json({ error: "You have already flagged this issue" }, { status: 400 });
    }

    const newFlagCount = (issue.flagCount || 0) + 1;
    const newFlaggedBy = [...flaggedBy, userId];

    const update: any = {
      flagCount: newFlagCount,
      flaggedBy: newFlaggedBy,
      lastFlagReason: reason || "Not specified",
    };

    if (newFlagCount >= 3) {
      update.status = "pending_review";
    }

    await issueRef.update(update);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[flag-issue] Error:", err);
    return NextResponse.json({ error: "Failed to flag issue." }, { status: 500 });
  }
}
