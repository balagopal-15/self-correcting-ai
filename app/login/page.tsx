"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as THREE from "three";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

    const count = 4000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0x7c3aed),
      new THREE.Color(0x06b6d4),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0xec4899),
      new THREE.Color(0x10b981),
      new THREE.Color(0x3b82f6),
    ];
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
    const particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.015, vertexColors: true, transparent: true, opacity: 0.9 }));
    scene.add(particles);

    const shapes: THREE.Mesh[] = [];
    const shapeColors = [0x7c3aed, 0x06b6d4, 0xf59e0b, 0xec4899, 0x10b981, 0x3b82f6, 0xa855f7, 0xf97316];
    for (let i = 0; i < 12; i++) {
      const size = Math.random() * 0.4 + 0.15;
      const geo = i % 3 === 0 ? new THREE.OctahedronGeometry(size) : i % 3 === 1 ? new THREE.TetrahedronGeometry(size) : new THREE.IcosahedronGeometry(size);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: shapeColors[i % shapeColors.length], wireframe: true, transparent: true, opacity: 0.5 }));
      m.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6);
      scene.add(m); shapes.push(m);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const lights = [
      { color: 0x7c3aed, pos: [5, 5, 5] },
      { color: 0x06b6d4, pos: [-5, -5, -5] },
      { color: 0xf59e0b, pos: [5, -5, 3] },
      { color: 0xec4899, pos: [-5, 5, -3] },
    ];
    lights.forEach(({ color, pos }) => {
      const l = new THREE.PointLight(color, 4, 25);
      l.position.set(pos[0], pos[1], pos[2]);
      scene.add(l);
    });
    camera.position.z = 7;

    let mouseX = 0, mouseY = 0;
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse);

    let id: number;
    const clock = new THREE.Clock();
    const animate = () => {
      id = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      particles.rotation.y = t * 0.04;
      particles.rotation.x = t * 0.02;
      shapes.forEach((s, i) => {
        s.rotation.x = t * (0.2 + i * 0.05);
        s.rotation.y = t * (0.3 + i * 0.04);
        s.position.y += Math.sin(t * 0.8 + i * 1.2) * 0.003;
        s.position.x += Math.cos(t * 0.6 + i * 0.9) * 0.002;
      });
      camera.position.x += (mouseX * 0.8 - camera.position.x) * 0.03;
      camera.position.y += (-mouseY * 0.8 - camera.position.y) * 0.03;
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  async function handleAuth() {
    setLoading(true); setError("");
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setError("Check your email for a confirmation link!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/dashboard");
    }
    setLoading(false);
  }

  const S = {
  page: { height: "100vh", background: "#020204", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", position: "relative" as const, overflow: "hidden" },
    canvas: { position: "fixed" as const, inset: 0, width: "100%", height: "100%", pointerEvents: "none" as const, zIndex: 0 },
    glow: { position: "fixed" as const, inset: 0, pointerEvents: "none" as const, zIndex: 1, background: "radial-gradient(ellipse at 20% 20%, rgba(124,58,237,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.25) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.2) 0%, transparent 50%), radial-gradient(ellipse at 100% 0%, rgba(245,158,11,0.15) 0%, transparent 40%)" },
wrap: { position: "relative" as const, zIndex: 2, width: "100%", maxWidth: "420px", padding: "0 20px", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0px)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)" },
  };

  return (
    <div style={S.page}>
      <canvas ref={canvasRef} style={S.canvas} />
      <div style={S.glow} />

      <div style={S.wrap}>

        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: "1px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "52px", height: "52px", borderRadius: "16px", background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 50%, #ec4899 100%)", marginBottom: "20px", boxShadow: "0 0 60px rgba(124,58,237,0.7), 0 0 120px rgba(6,182,212,0.3)" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "white", letterSpacing: "-1px" }}>AI</span>
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "white", margin: "0 0 8px", letterSpacing: "-0.8px", background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SandboxAI</h1>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>Self-Correcting AI Compiler</p>
          </div>
        </div>

        {/* Card */}
        <div style={{ borderRadius: "32px", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(60px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.03)", overflow: "hidden" }}>

          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative" as const }}>
            {[{ label: "Sign In", val: false }, { label: "Sign Up", val: true }].map(({ label, val }) => (
              <button key={label} onClick={() => { setIsSignUp(val); setError(""); }}
                style={{ flex: 1, padding: "20px 16px", border: "none", background: "transparent", color: isSignUp === val ? "white" : "rgba(255,255,255,0.25)", fontSize: "14px", fontWeight: isSignUp === val ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.3s", position: "relative" as const }}>
                {label}
                {isSignUp === val && (
                  <div style={{ position: "absolute" as const, bottom: 0, left: "20%", right: "20%", height: "2px", background: "linear-gradient(90deg, #7c3aed, #06b6d4)", borderRadius: "2px 2px 0 0" }} />
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: "28px 28px 24px" }}>
            <div style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "white", margin: "0 0 8px", letterSpacing: "-0.4px" }}>
                {isSignUp ? "Create your account" : "Welcome back"}
              </h2>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.6 }}>
                {isSignUp ? "Start building production-grade AI systems" : "Continue to your AI compiler workspace"}
              </p>
            </div>

            {/* Email field */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: "5px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Email address</label>
              <div style={{ position: "relative" as const }}>
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "15px 18px", borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: "15px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const, transition: "all 0.2s" }}
                  onFocus={(e) => { e.target.style.border = "1px solid rgba(124,58,237,0.7)"; e.target.style.background = "rgba(124,58,237,0.08)"; e.target.style.boxShadow = "0 0 0 4px rgba(124,58,237,0.1)"; }}
                  onBlur={(e) => { e.target.style.border = "1px solid rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.boxShadow = "none"; }} />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Password</label>
              <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                style={{ width: "100%", padding: "15px 18px", borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: "15px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const, transition: "all 0.2s" }}
                onFocus={(e) => { e.target.style.border = "1px solid rgba(6,182,212,0.7)"; e.target.style.background = "rgba(6,182,212,0.08)"; e.target.style.boxShadow = "0 0 0 4px rgba(6,182,212,0.1)"; }}
                onBlur={(e) => { e.target.style.border = "1px solid rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.boxShadow = "none"; }} />
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginBottom: "24px", padding: "14px 18px", borderRadius: "16px", background: error.includes("Check") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)", border: error.includes("Check") ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)" }}>
                <p style={{ fontSize: "13px", color: error.includes("Check") ? "#34d399" : "#f87171", margin: 0, lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            {/* CTA Button */}
            <button onClick={handleAuth} disabled={loading || !email || !password}
              style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "none", background: loading || !email || !password ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)", color: "white", fontSize: "15px", fontWeight: 700, cursor: loading || !email || !password ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: loading || !email || !password ? "none" : "0 8px 40px rgba(124,58,237,0.5), 0 4px 20px rgba(6,182,212,0.3)", transition: "all 0.3s", letterSpacing: "0.03em", marginBottom: "20px" }}>
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
            </button>

            {/* Toggle */}
            <p style={{ textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.3)", margin: 0 }}>
              {isSignUp ? "Already have an account? " : "New to SandboxAI? "}
              <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", padding: 0, background: "linear-gradient(135deg, #a78bfa, #06b6d4)" as unknown as string, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                {isSignUp ? "Sign in" : "Create account"}
              </button>
            </p>
          </div>
        </div>

        {/* Bottom badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginTop: "28px", flexWrap: "wrap" as const }}>
          {["Next.js 14", "Supabase Auth", "Groq AI"].map((badge) => (
            <div key={badge} style={{ padding: "6px 14px", borderRadius: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>
              {badge}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}