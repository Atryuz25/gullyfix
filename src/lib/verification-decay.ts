import { getFirestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

export interface DecayCheckResult {
  decayed: boolean;
  reason: string | null;
  trustScore: number;
}

export async function checkVerificationDecay(
  userId: string,
  issueId: string
): Promise<DecayCheckResult> {
  const db = getFirestore();
  
  // Check 1: Account age
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (!userData) return { decayed: false, reason: null, trustScore: 100 };
  
  let accountAgeDays = 999;
  if (userData.createdAt) {
    if (typeof userData.createdAt.toMillis === "function") {
      accountAgeDays = (Date.now() - userData.createdAt.toMillis()) / (1000 * 60 * 60 * 24);
    } else if (userData.createdAt.seconds) {
      accountAgeDays = (Date.now() - (userData.createdAt.seconds * 1000)) / (1000 * 60 * 60 * 24);
    } else if (typeof userData.createdAt === "string" || typeof userData.createdAt === "number") {
      accountAgeDays = (Date.now() - new Date(userData.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    }
  }
  
  const trustScore = typeof userData.trustScore === "number" ? userData.trustScore : 50;
  
  // Check 2: Rapid-fire verifications (more than 5 in last hour)
  const oneHourAgo = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const recentVerifications = await db
    .collection('verifications')
    .where('userId', '==', userId)
    .where('createdAt', '>', oneHourAgo)
    .get();
  
  const verificationsInLastHour = recentVerifications.size;
  
  // Decay conditions
  if (accountAgeDays < 3 && trustScore < 30) {
    return { 
      decayed: true, 
      reason: `New account (${Math.round(accountAgeDays)} days old) with low trust score (${trustScore})`,
      trustScore 
    };
  }
  
  if (verificationsInLastHour > 5 && trustScore < 50) {
    return { 
      decayed: true, 
      reason: `Rapid verification pattern: ${verificationsInLastHour} verifications in 1 hour`,
      trustScore 
    };
  }
  
  if (trustScore < 20) {
    return { 
      decayed: true, 
      reason: `Trust score critically low (${trustScore}/100)`,
      trustScore 
    };
  }
  
  return { decayed: false, reason: null, trustScore };
}
