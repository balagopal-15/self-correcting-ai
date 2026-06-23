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
          content: `You are a code generator. Write ONLY the code, no explanation, no markdown, no backticks. Just raw executable code. CRITICAL RULES: Keep the program under 30 lines. NEVER use interactive input (no cin, no input(), no Scanner) — the program must run with zero user input and produce output immediately. NEVER use file I/O (no fopen, no ifstream/ofstream, no file reading/writing). NEVER use GUI libraries or network requests. Use hardcoded sample data instead of asking for input. The language is ${language || "python"}. ${language === "cpp" ? "For C++: include #include <iostream>, use using namespace std;, write int main() that returns 0." : ""} ${language === "javascript" ? "For JavaScript: Node.js compatible only, use console.log." : ""} ${language === "java" ? "For Java: class must be named Main with public static void main(String[] args)." : ""}`,
        },
        {
          role: "user",
          content: `Task: ${prompt}`,
        },
      ],
      max_tokens: 2048,
    });

    const generatedCode = completion.choices[0].message.content ?? "";
    return NextResponse.json({ code: generatedCode });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("API Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}