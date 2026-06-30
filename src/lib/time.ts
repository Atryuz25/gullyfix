import { Timestamp } from "firebase/firestore";

export function formatTimeAgo(timestamp: Timestamp | null | undefined | Date): string {
  if (!timestamp) return "Unknown time";
  
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    // Check if it's a Firestore Timestamp with toDate method
    if (typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    } else {
      // It might be a serialized object { _seconds, _nanoseconds } or string
      date = new Date(
        (timestamp as any)._seconds 
          ? (timestamp as any)._seconds * 1000 
          : (timestamp as any)
      );
    }
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
}
