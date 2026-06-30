import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { action, userId, issueId, amount } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRef = adminDb.collection("users").doc(userId);
    const profileRef = adminDb.collection("public_profiles").doc(userId);
    
    let xpAward = amount || 0;
    if (action === "report_issue") xpAward = 20;
    if (action === "verify_issue") xpAward = 10;

    if (xpAward > 0) {
      // Award XP safely using merge
      await userRef.set({
        xpPoints: FieldValue.increment(xpAward),
      }, { merge: true });
      
      const profileUpdates: any = { xpPoints: FieldValue.increment(xpAward) };
      if (action === "verify_issue") {
        profileUpdates.verifyCount = FieldValue.increment(1);
      } else if (action === "report_issue") {
        profileUpdates.reportsCount = FieldValue.increment(1);
      }
      
      await profileRef.set(profileUpdates, { merge: true });
      
      // Basic badge logic
      const snap = await userRef.get();
      const xp = snap.data()?.xpPoints || 0;
      
      if (xp >= 150) {
        // Just an example badge unlock
        await userRef.update({
          badges: FieldValue.arrayUnion("level_2")
        });
      }
    }

    // If it's a verification, also increment issue verifyCount and add user to verifiedBy
    if (action === "verify_issue" && issueId) {
      const issueRef = adminDb.collection("issues").doc(issueId);
      await issueRef.update({
        verifyCount: FieldValue.increment(1),
        verifiedBy: FieldValue.arrayUnion(userId)
      });
    }

    return NextResponse.json({ success: true, xpAward });

  } catch (err: any) {
    console.error("[award-xp] Error:", err);
    return NextResponse.json({ error: "Failed to award XP. System temporarily unavailable." }, { status: 500 });
  }
}
