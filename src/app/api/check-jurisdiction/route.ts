import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(req: Request) {
  try {
    const { issueId } = await req.json();
    if (!issueId) {
      return NextResponse.json({ error: "Missing issueId" }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const issueRef = adminDb.collection("issues").doc(issueId);
    const issueSnap = await issueRef.get();

    if (!issueSnap.exists) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const data = issueSnap.data();
    const currentDept = data?.department;
    const category = data?.category;
    const description = data?.description || "";
    
    // Simplistic prompt for demo purposes
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
You are an AI department dispatcher for a civic issues app in India.
A municipal worker wants to reject an issue assigned to their department: "${currentDept}".
The issue category is: ${category}
User description: ${description}

Decide if the issue truly belongs to "${currentDept}" or a different department.
Valid departments: "GHMC Roads", "HMWSSB Water", "TSSPDCL Lights", "GHMC Sanitation", "Traffic Police".

Return a JSON object with this exact structure (nothing else):
{
  "correct": boolean,
  "actual_department": string
}
If "correct" is true, "actual_department" should be "${currentDept}".
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(text);

    if (!parsed.correct && parsed.actual_department) {
      await issueRef.update({ department: parsed.actual_department });
    }

    return NextResponse.json({ 
      data: {
        correct: parsed.correct,
        actual_department: parsed.actual_department
      }
    });

  } catch (err: any) {
    console.error("[check-jurisdiction] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
