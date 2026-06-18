import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, language } = body;

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a code generator. Write ONLY the code, no explanation, no markdown, no backticks. Just raw executable code. Do NOT use GUI libraries. Do NOT use file I/O or network requests. Only write code that produces text output to stdout. The language is ${language || "python"}.`,
        },
        {
          role: "user",
          content: `Task: ${prompt}`,
        },
      ],
      max_tokens: 1024,
    });

    const generatedCode = completion.choices[0].message.content ?? "";
    return NextResponse.json({ code: generatedCode });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("API Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}