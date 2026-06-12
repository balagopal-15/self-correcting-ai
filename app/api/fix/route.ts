import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, error, prompt } = body;

    if (!code || !error) {
      return NextResponse.json({ error: "Code and error are required" }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a code fixer. You will be given broken code and an error message. Fix the code. Write ONLY the fixed code, no explanation, no markdown, no backticks. Just raw executable code.",
        },
        {
          role: "user",
          content: `Original task: ${prompt}

Broken code:
${code}

Error message:
${error}

Write the fixed code:`,
        },
      ],
      max_tokens: 1024,
    });

    const fixedCode = completion.choices[0].message.content;

    return NextResponse.json({ code: fixedCode });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Fix Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}