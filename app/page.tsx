"use client";
import { useState } from "react";
import Editor from "@monaco-editor/react";
import * as Diff from "diff";

type Attempt = {
  attempt: number;
  code: string;
  error: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [language, setLanguage] = useState("python");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [running, setRunning] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [diffLines, setDiffLines] = useState<Diff.Change[]>([]);

  async function generateCode() {
    if (!prompt.trim()) return;
    setLoading(true);
    setCode("");
    setOutput("");
    setSuccess(null);
    setAttempts([]);
    setCurrentAttempt(0);
    

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    setCode(data.code);
    setLoading(false);
  }

  async function executeCode(codeToRun: string) {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeToRun, language }),
    });
    return await res.json();
  }

  async function fixCode(brokenCode: string, error: string) {
    const res = await fetch("/api/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: brokenCode, error, prompt }),
    });
    const data = await res.json();

    // Calculate diff
    const changes = Diff.diffLines(brokenCode, data.code);
    setDiffLines(changes);

    return data.code;
  }

  async function runAgenticLoop() {
    setRunning(true);
    setOutput("");
    setSuccess(null);
    setAttempts([]);
    setCurrentAttempt(0);

    let currentCode = code;
    const maxAttempts = 5;

    for (let i = 1; i <= maxAttempts; i++) {
      setCurrentAttempt(i);
      const result = await executeCode(currentCode);

      if (result.success) {
        setCode(currentCode);
        setOutput(result.stdout);
        setSuccess(true);
        setRunning(false);
        return;
      }

      const errorMsg = result.stderr || result.error;
      setAttempts(prev => [...prev, {
        attempt: i,
        code: currentCode,
        error: errorMsg,
      }]);

      if (i === maxAttempts) {
        setOutput(errorMsg);
        setSuccess(false);
        setRunning(false);
        return;
      }

      const fixed = await fixCode(currentCode, errorMsg);
      currentCode = fixed;
      setCode(fixed);
    }

    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">

      {/* Navbar */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold">AI</div>
          <span className="font-semibold text-white tracking-tight">SandboxAI</span>
          <span className="text-white/20 text-sm">/ compiler</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">powered by</span>
          <span className="text-xs text-violet-400 font-semibold">Groq · Llama 3.3</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Self-Correcting AI Compiler</h1>
          <p className="text-white/40 text-sm">Describe what you want → AI writes it → runs it → fixes errors automatically</p>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left panel */}
          <div className="space-y-4">

            {/* Language toggle */}
            <div className="flex gap-2">
              {["python", "javascript"].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    language === lang
                      ? "bg-violet-600 text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {lang === "python" ? "🐍 Python" : "🟨 JavaScript"}
                </button>
              ))}
            </div>

            {/* Prompt box */}
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                <span className="text-xs text-white/40">prompt</span>
              </div>
              <textarea
                className="w-full bg-transparent p-4 text-sm text-white/90 placeholder-white/20 resize-none focus:outline-none"
                rows={5}
                placeholder="e.g. Write a Python program to find all prime numbers up to 100"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/20">⌘ + Enter to generate</span>
                <button
                  onClick={generateCode}
                  disabled={loading || !prompt.trim()}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? "Generating..." : "Generate →"}
                </button>
              </div>
            </div>

            {/* Attempt timeline */}
            {attempts.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                  <span className="text-xs text-white/40">auto-fix attempts</span>
                </div>
                <div className="p-4 space-y-3">
                  {attempts.map((a) => (
                    <div key={a.attempt} className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-xs text-red-400 flex-shrink-0 mt-0.5">
                        {a.attempt}
                      </div>
                      <div>
                        <p className="text-xs text-red-400 font-semibold mb-0.5">Attempt {a.attempt} failed</p>
                        <p className="text-xs text-white/30 font-mono leading-relaxed">
                          {a.error.slice(0, 120)}{a.error.length > 120 ? "..." : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {running && (
                    <div className="flex gap-3 items-center">
                      <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-violet-400 animate-ping"></div>
                      </div>
                      <p className="text-xs text-violet-400">Fixing attempt {currentAttempt}...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Diff viewer */}
{diffLines.length > 0 && (
  <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
    <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
      <span className="text-xs text-white/40">what AI changed</span>
      <span className="ml-auto text-xs text-white/20">
        +{diffLines.filter(l => l.added).length} / -{diffLines.filter(l => l.removed).length} lines
      </span>
    </div>
    <div className="p-4 overflow-auto max-h-48">
      {diffLines.map((part, index) => (
        <pre
          key={index}
          className={`text-xs leading-relaxed whitespace-pre-wrap ${
            part.added
              ? "text-green-400 bg-green-500/10"
              : part.removed
              ? "text-red-400 bg-red-500/10 line-through opacity-60"
              : "text-white/30"
          }`}
        >
          {part.added ? "+ " : part.removed ? "- " : "  "}
          {part.value}
        </pre>
      ))}
    </div>
  </div>
)}

            {/* Output panel */}
            {output && (
              <div className={`rounded-xl border overflow-hidden ${success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${success ? "bg-green-500" : "bg-red-500"}`}></div>
                  <span className="text-xs text-white/40">{success ? "output" : "error"}</span>
                  {success && attempts.length > 0 && (
                    <span className="ml-auto text-xs text-green-400">✓ fixed in {attempts.length + 1} attempts</span>
                  )}
                  {success && attempts.length === 0 && (
                    <span className="ml-auto text-xs text-green-400">✓ passed on first run</span>
                  )}
                </div>
                <pre className={`p-4 text-xs leading-relaxed overflow-auto max-h-48 ${success ? "text-green-300" : "text-red-300"}`}>
                  {output}
                </pre>
              </div>
            )}
          </div>

          {/* Right panel — Monaco Editor */}
          <div className="rounded-xl border border-white/10 bg-[#1e1e1e] overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-[#1e1e1e]">
              <div className="flex items-center gap-2">
                {/* Traffic light dots */}
                <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/70"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/70"></div>
                <span className="text-xs text-white/30 ml-2">
                  {language === "python" ? "main.py" : "main.js"}
                </span>
              </div>
              {code && (
                <button
                  onClick={runAgenticLoop}
                  disabled={running}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {running ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-300 animate-ping"></div>
                      Running...
                    </>
                  ) : (
                    <>▶ Run & Auto-fix</>
                  )}
                </button>
              )}
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 min-h-[500px]">
              {!code && !loading && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20">
                  <div className="text-4xl">⌨️</div>
                  <p className="text-sm">Generated code will appear here</p>
                </div>
              )}
              {loading && (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <p className="text-xs text-white/40">AI is writing your code...</p>
                </div>
              )}
              {code && (
                <Editor
                  height="500px"
                  language={language === "python" ? "python" : "javascript"}
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: "on",
                    renderLineHighlight: "line",
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                    padding: { top: 16, bottom: 16 },
                  }}
                />
              )}
            </div>

            {/* Footer */}
            {code && (
              <div className="px-4 py-2 border-t border-white/10 bg-[#1e1e1e] flex items-center justify-between">
                <span className="text-xs text-white/20">{code.split("\n").length} lines</span>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  copy
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-6 flex items-center justify-between text-xs text-white/20">
          <span>Self-Correcting AI Compiler · Built with Next.js + Groq</span>
          <span>{success === true ? "🟢 last run succeeded" : success === false ? "🔴 last run failed" : "⚪ ready"}</span>
        </div>
      </div>
    </div>
  );
}