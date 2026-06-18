import { NextRequest, NextResponse } from "next/server";

const LANGUAGE_IDS: { [key: string]: number } = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  go: 60,
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

    const submitRes = await fetch(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: "",
      }),
    });

    const result = await submitRes.json();

    const stdout = result.stdout || "";
    const stderr = result.stderr || result.compile_output || result.message || "";
    const success = result.status?.id === 3;

    return NextResponse.json({ stdout, stderr, exitCode: success ? 0 : 1, success });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Execute Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}