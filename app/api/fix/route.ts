import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, error, prompt, language } = body;

    if (!code || !error) {
      return NextResponse.json({ error: "Code and error are required" }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a code fixer. Fix the broken code. Write ONLY the fixed code, no explanation, no markdown, no backticks. Just raw executable code.",
        },
        {
          role: "user",
          content: `Original task: ${prompt}\nLanguage: ${language || "python"}\n\nBroken code:\n${code}\n\nError:\n${error}\n\nWrite the fixed code:`,
        },
      ],
      max_tokens: 2048,
    });

    const fixedCode = completion.choices[0].message.content ?? "";
    return NextResponse.json({ code: fixedCode });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Fix Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}