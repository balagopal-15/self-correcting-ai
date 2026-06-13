"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Session = {
  id: string;
  prompt: string;
  final_code: string;
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
  const router = useRouter();

  useEffect(() => {
    checkUser();
    fetchSessions();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
    } else {
      setUser(user);
    }
  }

  async function fetchSessions() {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const totalRuns = sessions.length;
  const successRate = totalRuns > 0
    ? Math.round((sessions.filter(s => s.success).length / totalRuns) * 100)
    : 0;
  const avgAttempts = totalRuns > 0
    ? (sessions.reduce((sum, s) => sum + s.attempts, 0) / totalRuns).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">

      {/* Navbar */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold">AI</div>
          <span className="font-semibold text-white tracking-tight">SandboxAI</span>
          <span className="text-white/20 text-sm">/ dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/40">{user?.email}</span>
          <button
            onClick={() => router.push("/")}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-violet-600 hover:bg-violet-500 transition-all"
          >
            + New Run
          </button>
          <button
            onClick={signOut}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white/5 hover:bg-white/10 transition-all"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-white/40 text-sm">Your AI compiler history and stats</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/40 mb-1">Total Runs</p>
            <p className="text-3xl font-bold text-white">{totalRuns}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/40 mb-1">Success Rate</p>
            <p className="text-3xl font-bold text-green-400">{successRate}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/40 mb-1">Avg Attempts</p>
            <p className="text-3xl font-bold text-violet-400">{avgAttempts}</p>
          </div>
        </div>

        {/* Sessions list */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500"></div>
            <span className="text-xs text-white/40">recent runs</span>
          </div>

          {loading && (
            <div className="p-8 text-center text-white/30 text-sm">Loading...</div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-white/30 text-sm mb-4">No runs yet</p>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500"
              >
                Start your first run →
              </button>
            </div>
          )}

          {sessions.map((session) => (
            <div key={session.id} className="px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${session.success ? "bg-green-500" : "bg-red-500"}`}></span>
                    <p className="text-sm text-white truncate">{session.prompt}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-white/30">{session.language}</span>
                    <span className="text-xs text-white/30">{session.attempts} attempts</span>
                    <span className="text-xs text-white/20">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-semibold flex-shrink-0 ${session.success ? "text-green-400" : "text-red-400"}`}>
                  {session.success ? "✓ passed" : "✗ failed"}
                </span>
              </div>
              {session.output && (
                <pre className="mt-2 ml-4 text-xs text-white/30 truncate">{session.output}</pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}