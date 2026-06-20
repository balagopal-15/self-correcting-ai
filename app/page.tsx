"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import * as Diff from "diff";
import { supabase } from "@/lib/supabase";
import * as THREE from "three";

type Attempt = { attempt: number; code: string; error: string };

const LANGUAGES = [
  { id: "python", label: "Python", icon: "🐍", file: "main.py" },
  { id: "javascript", label: "JavaScript", icon: "🟨", file: "main.js" },
  { id: "java", label: "Java", icon: "☕", file: "Main.java" },
  { id: "cpp", label: "C++", icon: "⚡", file: "main.cpp" },
  { id: "go", label: "Go", icon: "🐹", file: "main.go" },
];

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
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentLang = LANGUAGES.find(l => l.id === language)!;

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(0x7c3aed), new THREE.Color(0x06b6d4), new THREE.Color(0xf59e0b), new THREE.Color(0xec4899), new THREE.Color(0x10b981), new THREE.Color(0x3b82f6)];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.012, vertexColors: true, transparent: true, opacity: 0.7 }));
    scene.add(particles);

    const shapes: THREE.Mesh[] = [];
    const shapeColors = [0x7c3aed, 0x06b6d4, 0xf59e0b, 0xec4899, 0x10b981, 0x3b82f6, 0xa855f7, 0xf97316];
    for (let i = 0; i < 10; i++) {
      const size = Math.random() * 0.35 + 0.12;
      const g = i % 3 === 0 ? new THREE.OctahedronGeometry(size) : i % 3 === 1 ? new THREE.TetrahedronGeometry(size) : new THREE.IcosahedronGeometry(size);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: shapeColors[i % shapeColors.length], wireframe: true, transparent: true, opacity: 0.4 }));
      m.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 6);
      scene.add(m); shapes.push(m);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    [[0x7c3aed, [5, 5, 5]], [0x06b6d4, [-5, -5, -5]], [0xf59e0b, [5, -5, 3]], [0xec4899, [-5, 5, -3]]].forEach(([color, pos]) => {
      const l = new THREE.PointLight(color as number, 3, 25);
      l.position.set((pos as number[])[0], (pos as number[])[1], (pos as number[])[2]);
      scene.add(l);
    });
    camera.position.z = 7;

    let mouseX = 0, mouseY = 0;
    const onMouse = (e: MouseEvent) => { mouseX = (e.clientX / window.innerWidth - 0.5) * 2; mouseY = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener("mousemove", onMouse);

    let id: number;
    const clock = new THREE.Clock();
    const animate = () => {
      id = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      particles.rotation.y = t * 0.03;
      particles.rotation.x = t * 0.015;
      shapes.forEach((s, i) => {
        s.rotation.x = t * (0.15 + i * 0.04);
        s.rotation.y = t * (0.2 + i * 0.03);
        s.position.y += Math.sin(t * 0.6 + i) * 0.002;
      });
      camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.03;
      camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.03;
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(id); window.removeEventListener("mousemove", onMouse); window.removeEventListener("resize", onResize); renderer.dispose(); };
  }, []);

  async function generateCode() {
    if (!prompt.trim()) return;
    setLoading(true); setCode(""); setOutput(""); setSuccess(null);
    setAttempts([]); setCurrentAttempt(0); setDiffLines([]);
    const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, language }) });
    const data = await res.json();
    setCode(data.code ?? "");
    setLoading(false);
  }

  async function executeCode(codeToRun: string) {
    const res = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: codeToRun, language }) });
    return await res.json();
  }

 async function fixCode(brokenCode: string, error: string) {
    const res = await fetch("/api/fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: brokenCode, error, prompt, language }) });
    const data = await res.json();
    const fixedCode = data.code ?? brokenCode;
    if (data.code) setDiffLines(Diff.diffLines(brokenCode, fixedCode));
    return fixedCode;
  }
  async function runAgenticLoop() {
    setRunning(true); setOutput(""); setSuccess(null); setAttempts([]); setCurrentAttempt(0);
    let currentCode = code;
    for (let i = 1; i <= 5; i++) {
      setCurrentAttempt(i);
      const result = await executeCode(currentCode);
      if (result.success) {
        setCode(currentCode); setOutput(result.stdout); setSuccess(true); setRunning(false);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from("sessions").insert({ user_id: user.id, prompt, final_code: currentCode, output: result.stdout, success: true, attempts: i, language });
        return;
      }
      const errorMsg = result.stderr || result.error;
      setAttempts(prev => [...prev, { attempt: i, code: currentCode, error: errorMsg }]);
      if (i === 5) {
        setOutput(errorMsg); setSuccess(false); setRunning(false);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from("sessions").insert({ user_id: user.id, prompt, final_code: currentCode, output: errorMsg, success: false, attempts: i, language });
        return;
      }
      currentCode = await fixCode(currentCode, errorMsg);
      setCode(currentCode);
    }
    setRunning(false);
  }

  return (
   <div style={{ height: "100vh", overflow: "auto", background: "#020204", color: "white", fontFamily: "'Inter', system-ui, sans-serif", position: "relative" }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, background: "radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.15) 0%, transparent 50%), radial-gradient(ellipse at 100% 50%, rgba(236,72,153,0.1) 0%, transparent 40%)" }} />

      <div style={{ position: "relative", zIndex: 2, opacity: mounted ? 1 : 0, transition: "opacity 0.8s ease" }}>

        {/* Navbar */}
        <nav style={{ position: "sticky", top: 0, padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(2,2,4,0.8)", backdropFilter: "blur(40px)", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "linear-gradient(135deg, #7c3aed, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800, color: "white", boxShadow: "0 0 20px rgba(124,58,237,0.5)" }}>AI</div>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "white", letterSpacing: "-0.3px" }}>SandboxAI</span>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "14px" }}>/</span>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>compiler</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => router.push("/dashboard")}
              style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
              Dashboard
            </button>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>powered by</span>
            <span style={{ fontSize: "13px", fontWeight: 700, background: "linear-gradient(135deg, #a78bfa, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Groq · Llama 3.3</span>
          </div>
        </nav>

       <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "12px 20px"}}>

          {/* Header */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "white", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              Self-Correcting AI Compiler
            </h1>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", margin: 0 }}>
              Describe what you want → AI writes it → runs it → fixes errors automatically
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

            {/* LEFT PANEL */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Language selector */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {LANGUAGES.map(lang => (
                  <button key={lang.id} onClick={() => setLanguage(lang.id)}
                    style={{ padding: "8px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "none", fontFamily: "inherit", transition: "all 0.2s", ...(language === lang.id ? { background: "linear-gradient(135deg, #7c3aed, #06b6d4)", color: "white", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" } : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", outline: "1px solid rgba(255,255,255,0.07)" }) }}>
                    {lang.icon} {lang.label}
                  </button>
                ))}
              </div>

              {/* Prompt box */}
              <div style={{ borderRadius: "24px", overflow: "hidden", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #06b6d4)", boxShadow: "0 0 8px rgba(124,58,237,0.8)" }}></div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Prompt</span>
                </div>
                <textarea
                  style={{ width: "100%", background: "transparent", padding: "20px", fontSize: "14px", color: "rgba(255,255,255,0.85)", resize: "none", outline: "none", border: "none", lineHeight: 1.7, fontFamily: "inherit", boxSizing: "border-box" }}
                  rows={6}
                  placeholder={`Describe what ${currentLang.label} code you want...`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generateCode(); }}
                />
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.15)" }}>Ctrl + Enter to generate</span>
                  <button onClick={generateCode} disabled={loading || !prompt.trim()}
                    style={{ padding: "10px 24px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: loading || !prompt.trim() ? "not-allowed" : "pointer", border: "none", fontFamily: "inherit", background: loading || !prompt.trim() ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed, #06b6d4)", color: "white", boxShadow: loading || !prompt.trim() ? "none" : "0 4px 20px rgba(124,58,237,0.4)", transition: "all 0.2s" }}>
                    {loading ? "Generating..." : "Generate →"}
                  </button>
                </div>
              </div>

              {/* Attempt timeline */}
              {attempts.length > 0 && (
                <div style={{ borderRadius: "20px", overflow: "hidden", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(239,68,68,0.08)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444" }}></div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#f87171", letterSpacing: "0.08em", textTransform: "uppercase" }}>Auto-fix Attempts</span>
                  </div>
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {attempts.map(a => (
                      <div key={a.attempt} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#f87171", flexShrink: 0 }}>{a.attempt}</div>
                        <div>
                          <p style={{ fontSize: "12px", color: "#f87171", fontWeight: 600, margin: "0 0 3px" }}>Attempt {a.attempt} failed</p>
                          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", fontFamily: "monospace", margin: 0, lineHeight: 1.6 }}>{a.error.slice(0, 100)}{a.error.length > 100 ? "..." : ""}</p>
                        </div>
                      </div>
                    ))}
                    {running && (
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#a78bfa", animation: "pulse 1s infinite" }}></div>
                        </div>
                        <p style={{ fontSize: "12px", color: "#a78bfa", margin: 0 }}>AI fixing attempt {currentAttempt}...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Diff viewer */}
              {diffLines.length > 0 && (
                <div style={{ borderRadius: "20px", overflow: "hidden", background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.12)" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(6,182,212,0.08)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#06b6d4" }}></div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#22d3ee", letterSpacing: "0.08em", textTransform: "uppercase" }}>What AI Changed</span>
                    <span style={{ marginLeft: "auto", fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>+{diffLines.filter(l => l.added).length} / -{diffLines.filter(l => l.removed).length} lines</span>
                  </div>
                  <div style={{ padding: "16px 20px", overflow: "auto", maxHeight: "160px" }}>
                    {diffLines.map((part, i) => (
                      <pre key={i} style={{ fontSize: "11px", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, color: part.added ? "#34d399" : part.removed ? "#f87171" : "rgba(255,255,255,0.18)", textDecoration: part.removed ? "line-through" : "none", opacity: part.removed ? 0.5 : 1 }}>
                        {part.added ? "+ " : part.removed ? "- " : "  "}{part.value}
                      </pre>
                    ))}
                  </div>
                </div>
              )}

              {/* Output */}
              {output && (
                <div style={{ borderRadius: "20px", overflow: "hidden", background: success ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)", border: success ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(239,68,68,0.15)" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: success ? "#10b981" : "#ef4444", boxShadow: success ? "0 0 8px rgba(16,185,129,0.8)" : "0 0 8px rgba(239,68,68,0.8)" }}></div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: success ? "#34d399" : "#f87171", letterSpacing: "0.08em", textTransform: "uppercase" }}>{success ? "Output" : "Error"}</span>
                    {success && <span style={{ marginLeft: "auto", fontSize: "12px", color: "#34d399", fontWeight: 600 }}>✓ {attempts.length > 0 ? `Fixed in ${attempts.length + 1} attempts` : "Passed on first run"}</span>}
                  </div>
                  <pre style={{ padding: "20px", fontSize: "13px", lineHeight: 1.7, overflow: "auto", maxHeight: "200px", color: success ? "#86efac" : "#fca5a5", fontFamily: "monospace", margin: 0 }}>{output}</pre>
                </div>
              )}
            </div>

            {/* RIGHT PANEL — Monaco */}
            <div style={{ borderRadius: "24px", overflow: "hidden", background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ff5f57" }}></div>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#febc2e" }}></div>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#28c840" }}></div>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)", marginLeft: "8px", fontFamily: "monospace" }}>{currentLang.file}</span>
                </div>
                {code && (
                  <button onClick={runAgenticLoop} disabled={running}
                    style={{ padding: "8px 20px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: running ? "not-allowed" : "pointer", border: "none", fontFamily: "inherit", background: running ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #059669, #10b981)", color: "white", boxShadow: running ? "none" : "0 4px 20px rgba(16,185,129,0.4)", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" }}>
                    {running ? (
                      <><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "white", animation: "pulse 1s infinite" }}></div>Running...</>
                    ) : "▶ Run & Auto-fix"}
                  </button>
                )}
              </div>

              <div style={{ flex: 1, minHeight: "520px" }}>
                {!code && !loading && (
                  <div style={{ height: "520px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
                    <div style={{ fontSize: "52px", filter: "grayscale(0.3)" }}>⌨️</div>
                    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.15)", margin: 0 }}>Generated code will appear here</p>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.08)", margin: 0 }}>Write a prompt and click Generate</p>
                  </div>
                )}
                {loading && (
                  <div style={{ height: "520px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {[0, 1, 2].map(d => (
                        <div key={d} style={{ width: "10px", height: "10px", borderRadius: "50%", background: d === 0 ? "#7c3aed" : d === 1 ? "#06b6d4" : "#ec4899", animation: "bounce 1s infinite", animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </div>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", margin: 0 }}>Writing your {currentLang.label} code...</p>
                  </div>
                )}
                {code && (
                  <Editor
                    height="520px"
                    language={currentLang.id === "cpp" ? "cpp" : currentLang.id}
                    value={code}
                    onChange={(val) => setCode(val || "")}
                    theme="vs-dark"
                    options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: "on", renderLineHighlight: "line", automaticLayout: true, tabSize: 2, wordWrap: "on", padding: { top: 20, bottom: 20 }, fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace" }}
                  />
                )}
              </div>

              {code && (
                <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.18)" }}>{code.split("\n").length} lines · {currentLang.label}</span>
                  <button onClick={() => navigator.clipboard.writeText(code)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "rgba(255,255,255,0.25)", fontFamily: "inherit" }}>Copy</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "rgba(255,255,255,0.12)" }}>
            <span>SandboxAI · Next.js + Groq + Judge0</span>
            <span>{success === true ? "🟢 Last run succeeded" : success === false ? "🔴 Last run failed" : "⚪ Ready"}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}