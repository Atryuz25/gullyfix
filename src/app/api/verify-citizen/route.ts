import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { checkVerificationDecay } from '@/lib/verification-decay';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { issueId, userId } = await request.json();
    
    if (!issueId || !userId) {
      return Response.json({ success: false, error: 'Missing issueId or userId' }, { status: 400 });
    }

    const decayResult = await checkVerificationDecay(userId, issueId);
    
    const db = adminDb;
    const issueRef = db.collection('issues').doc(issueId);
    
    // Log the verification attempt regardless
    await db.collection('verifications').add({
      userId,
      issueId,
      createdAt: Timestamp.now(),
      decayed: decayResult.decayed,
      decayReason: decayResult.reason,
    });
    
    if (decayResult.decayed) {
      // Increment suspicious flag count on issue
      await issueRef.update({
        quarantineFlags: FieldValue.increment(1),
      });
      
      // If 3+ decayed votes, route to quarantine
      const issueDoc = await issueRef.get();
      const quarantineFlags = (issueDoc.data()?.quarantineFlags || 0); // it was already incremented by the update above, but getting the latest
      
      if (quarantineFlags >= 3) {
        await issueRef.update({
          quarantineStatus: 'flagged',
          quarantineReason: 'Suspicious verification pattern detected by integrity engine',
        });
      }
      
      return Response.json({ 
        success: false, 
        decayed: true,
        message: 'Vote integrity check failed — vote not counted'
      });
    }
    
    // Legitimate vote — increment verifyCount and award XP
    await issueRef.update({
      verifyCount: FieldValue.increment(1),
      verifiedBy: FieldValue.arrayUnion(userId),
    });
    
    // Award XP
    // Note: To call another API route from within an API route in Next.js, we usually fetch absolute URL or call the logic directly.
    // We'll call the absolute URL. We must be careful about host headers or we can just import the logic.
    // For simplicity per spec:
    const baseUrl = request.headers.get('origin') || 'http://localhost:3000';
    try {
      await fetch(`${baseUrl}/api/award-xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: 10, reason: 'verification' })
      });
    } catch (e) {
      console.warn("Could not award XP in citizen verify route", e);
    }
    
    return Response.json({ 
      success: true, 
      decayed: false,
      xpAwarded: 10
    });
  } catch (error: any) {
    return Response.json({ success: false, error: "Verification system temporarily unavailable. Please try again later." }, { status: 500 });
  }
}
