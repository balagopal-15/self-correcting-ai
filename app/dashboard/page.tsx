"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as THREE from "three";

type Session = {
  id: string;
  prompt: string;
  output: string;
  success: boolean;
  attempts: number;
  language: string;
  created_at: string;
};

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const count = 1000;
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
    for (let i = 0; i < 5; i++) {
      const size = Math.random() * 0.4 + 0.15;
      const g = i % 3 === 0 ? new THREE.OctahedronGeometry(size) : i % 3 === 1 ? new THREE.TetrahedronGeometry(size) : new THREE.IcosahedronGeometry(size);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: shapeColors[i % shapeColors.length], wireframe: true, transparent: true, opacity: 0.4 }));
      m.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 6);
      scene.add(m); shapes.push(m);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    [[0x7c3aed, [5, 5, 5]], [0x06b6d4, [-5, -5, -5]]].forEach(([color, pos]) => {
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

  useEffect(() => { checkUser(); fetchSessions(); }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) router.push("/login");
    else setUser(user);
  }

  async function fetchSessions() {
    const { data, error } = await supabase.from("sessions").select("*").order("created_at", { ascending: false }).limit(20);
    if (!error && data) setSessions(data);
    setLoading(false);
  }

  async function signOut() { await supabase.auth.signOut(); router.push("/login"); }

  const totalRuns = sessions.length;
  const successRate = totalRuns > 0 ? Math.round((sessions.filter(s => s.success).length / totalRuns) * 100) : 0;
  const avgAttempts = totalRuns > 0 ? (sessions.reduce((sum, s) => sum + s.attempts, 0) / totalRuns).toFixed(1) : "0";
  const totalFixed = sessions.filter(s => s.success && s.attempts > 1).length;

  const langColors: Record<string, string> = {
    python: "rgba(245,158,11,0.15)",
    javascript: "rgba(6,182,212,0.15)",
    java: "rgba(236,72,153,0.15)",
    cpp: "rgba(124,58,237,0.15)",
    go: "rgba(16,185,129,0.15)",
  };
  const langTextColors: Record<string, string> = {
    python: "#fbbf24",
    javascript: "#22d3ee",
    java: "#f472b6",
    cpp: "#a78bfa",
    go: "#34d399",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020204", fontFamily: "'Inter', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, background: "radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.25) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.2) 0%, transparent 50%), radial-gradient(ellipse at 100% 50%, rgba(236,72,153,0.15) 0%, transparent 40%)" }} />

      <div style={{ position: "relative", zIndex: 2, opacity: mounted ? 1 : 0, transition: "opacity 0.8s ease" }}>

        {/* Navbar */}
        <nav style={{ position: "sticky", top: 0, padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(2,2,4,0.8)", backdropFilter: "blur(40px)", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "linear-gradient(135deg, #7c3aed, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800, color: "white", boxShadow: "0 0 20px rgba(124,58,237,0.5)" }}>AI</div>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "white", letterSpacing: "-0.3px" }}>SandboxAI</span>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "14px" }}>/</span>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>dashboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</span>
            <button onClick={() => router.push("/")}
              style={{ padding: "8px 20px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #7c3aed, #06b6d4)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
              + New Run
            </button>
            <button onClick={signOut}
              style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
              Sign Out
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 40px" }}>

          {/* Header */}
          <div style={{ marginBottom: "48px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "20px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", marginBottom: "16px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7c3aed", boxShadow: "0 0 6px #7c3aed" }}></div>
              <span style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Your Workspace</span>
            </div>
            <h1 style={{ fontSize: "36px", fontWeight: 800, color: "white", margin: "0 0 8px", letterSpacing: "-0.8px" }}>Dashboard</h1>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.35)", margin: 0 }}>Track your AI compiler sessions and performance metrics</p>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "40px" }}>
            {[
              { label: "Total Runs", value: totalRuns, color: "#a78bfa", glow: "rgba(124,58,237,0.3)", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)" },
              { label: "Success Rate", value: `${successRate}%`, color: "#34d399", glow: "rgba(16,185,129,0.3)", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)" },
              { label: "Avg Attempts", value: avgAttempts, color: "#22d3ee", glow: "rgba(6,182,212,0.3)", bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.2)" },
              { label: "Auto-Fixed", value: totalFixed, color: "#fb923c", glow: "rgba(249,115,22,0.3)", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)" },
            ].map(({ label, value, color, glow, bg, border }) => (
              <div key={label} style={{ padding: "28px 24px", borderRadius: "24px", background: bg, border: `1px solid ${border}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: "80px", height: "80px", borderRadius: "50%", background: glow, filter: "blur(30px)" }} />
                <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.4)", margin: "0 0 12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</p>
                <p style={{ fontSize: "40px", fontWeight: 800, color, margin: 0, letterSpacing: "-1px", lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sessions */}
          <div style={{ borderRadius: "28px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", backdropFilter: "blur(20px)" }}>

            {/* Table header */}
            <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #06b6d4)", boxShadow: "0 0 8px #7c3aed" }}></div>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>Recent Sessions</span>
              </div>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>{totalRuns} total</span>
            </div>

            {loading && (
              <div style={{ padding: "60px", textAlign: "center" }}>
                <div style={{ display: "inline-flex", gap: "6px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7c3aed", animation: "bounce 1s infinite", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div style={{ padding: "80px 40px", textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚀</div>
                <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.3)", margin: "0 0 24px" }}>No runs yet. Start your first session!</p>
                <button onClick={() => router.push("/")}
                  style={{ padding: "12px 28px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #7c3aed, #06b6d4)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 30px rgba(124,58,237,0.4)" }}>
                  Start First Run
                </button>
              </div>
            )}

            {sessions.map((session, idx) => (
              <div key={session.id}
                style={{ padding: "20px 28px", borderBottom: idx < sessions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", gap: "16px", transition: "background 0.2s", cursor: "default" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>

                {/* Status dot */}
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: session.success ? "#10b981" : "#ef4444", boxShadow: session.success ? "0 0 8px rgba(16,185,129,0.6)" : "0 0 8px rgba(239,68,68,0.6)", flexShrink: 0 }} />

                {/* Prompt */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", margin: "0 0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{session.prompt}</p>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", background: langColors[session.language] || "rgba(255,255,255,0.05)", color: langTextColors[session.language] || "rgba(255,255,255,0.4)", fontWeight: 600 }}>{session.language}</span>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>{session.attempts} attempt{session.attempts !== 1 ? "s" : ""}</span>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>{new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>

                {/* Status badge */}
                <div style={{ padding: "5px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, background: session.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: session.success ? "#34d399" : "#f87171", border: session.success ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,68,68,0.2)", flexShrink: 0 }}>
                  {session.success ? "Passed" : "Failed"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }`}</style>
    </div>
  );
}