import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { execa } from "execa";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, language } = body;

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // Create temp folder
    const tempDir = join(process.cwd(), "temp");
    await mkdir(tempDir, { recursive: true });

    // Save code to a temp file
    const ext = language === "javascript" ? "js" : "py";
    const filePath = join(tempDir, `code.${ext}`);
    await writeFile(filePath, code, "utf-8");

    // Run the code
    const command = language === "javascript" ? "node" : "python";
    const result = await execa(command, [filePath], {
      timeout: 10000,
      reject: false,
    });

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      success: result.exitCode === 0,
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Execute Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}