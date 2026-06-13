import { NextRequest, NextResponse } from "next/server";

// Judge0 language IDs
const LANGUAGE_IDS: { [key: string]: number } = {
  python: 71,     // Python 3
  javascript: 63, // Node.js
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, language } = body;

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const languageId = LANGUAGE_IDS[language] || 71;
    const judge0Url = process.env.JUDGE0_API_URL || "https://ce.judge0.com";

    // Step 1: Submit code to Judge0
    const submitRes = await fetch(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: "",
      }),
    });

    const result = await submitRes.json();

    // Step 2: Parse the result
    const stdout = result.stdout || "";
    const stderr = result.stderr || result.compile_output || result.message || "";
    const exitCode = result.exit_code ?? (result.status?.id === 3 ? 0 : 1);
    const success = result.status?.id === 3; // 3 = Accepted in Judge0

    return NextResponse.json({
      stdout,
      stderr,
      exitCode,
      success,
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Execute Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}