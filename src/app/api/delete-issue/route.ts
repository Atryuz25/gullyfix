import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { userId, issueId } = await req.json();

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

    // Only allow owner to delete (or we can just allow it for the demo)
    const issue = snap.data()!;
    if (issue.reportedBy !== userId) {
        return NextResponse.json({ error: "Only the reporter can delete this issue" }, { status: 403 });
    }

    await issueRef.delete();
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[delete-issue] Error:", err);
    return NextResponse.json({ error: "Failed to delete issue." }, { status: 500 });
  }
}
