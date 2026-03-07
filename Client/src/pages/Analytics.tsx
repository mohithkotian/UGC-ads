// pages/Analytics.tsx
import { useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_API_URL || "https://ugc-ads.onrender.com";
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || "";

interface Summary {
  totalVisits: number;
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
  avgTimeOnPage: number;
  byCountry: { country: string; _count: { country: number } }[];
  byDevice: { deviceType: string; _count: { deviceType: number } }[];
  byBrowser: { browser: string; _count: { browser: number } }[];
  byPage: { path: string; _count: { path: number } }[];
  recentVisitors: {
    ip: string;
    city: string;
    country: string;
    deviceType: string;
    browser: string;
    path: string;
    isNew: boolean;
    timeOnPage: number | null;
    visitedAt: string;
  }[];
  topClicks: { element: string; _count: { element: number } }[];
}

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ fontSize: 13, color: "#888", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
    <span style={{ fontSize: 36, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</span>
    {sub && <span style={{ fontSize: 12, color: "#666" }}>{sub}</span>}
  </div>
);

const Bar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#888" }}>{value}</span>
    </div>
    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 99, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  </div>
);

export default function Analytics() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/stats/visitors/summary`, {
        headers: { "x-admin-key": ADMIN_KEY },
      });
      setSummary(res.data);
      setLastRefresh(new Date());
    } catch {
      setError("Unauthorized or failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'DM Mono', 'Fira Code', monospace", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>UGC.AI</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>Visitor Intelligence</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <button onClick={fetchData} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              Refresh
            </button>
            <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>Last updated {lastRefresh.toLocaleTimeString()}</div>
          </div>
        </div>

        {loading && <div style={{ textAlign: "center", color: "#555", padding: 80 }}>Loading data...</div>}
        {error && <div style={{ textAlign: "center", color: "#ff4444", padding: 80 }}>{error}</div>}

        {summary && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
              <StatCard label="Total Visits" value={summary.totalVisits} />
              <StatCard label="Unique Visitors" value={summary.uniqueVisitors} />
              <StatCard label="New Visitors" value={summary.newVisitors} sub="First time" />
              <StatCard label="Returning" value={summary.returningVisitors} sub="Came back" />
              <StatCard label="Avg Time on Page" value={formatTime(summary.avgTimeOnPage)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Top Countries</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {summary.byCountry.map((c) => (
                    <Bar key={c.country} label={c.country} value={c._count.country} max={summary.byCountry[0]._count.country} color="linear-gradient(90deg, #6366f1, #8b5cf6)" />
                  ))}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Top Pages</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {summary.byPage.map((p) => (
                    <Bar key={p.path} label={p.path} value={p._count.path} max={summary.byPage[0]._count.path} color="linear-gradient(90deg, #10b981, #059669)" />
                  ))}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Most Clicked</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {summary.topClicks.length > 0 ? summary.topClicks.map((c) => (
                    <Bar key={c.element} label={c.element} value={c._count.element} max={summary.topClicks[0]._count.element} color="linear-gradient(90deg, #f59e0b, #d97706)" />
                  )) : (
                    <span style={{ color: "#555", fontSize: 13 }}>No clicks tracked yet</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Device Type</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {summary.byDevice.map((d) => (
                    <div key={d.deviceType} style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "20px 12px" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>
                        {d.deviceType === "mobile" ? "📱" : d.deviceType === "tablet" ? "📟" : "💻"}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{d._count.deviceType}</div>
                      <div style={{ fontSize: 11, color: "#666", textTransform: "capitalize", marginTop: 4 }}>{d.deviceType}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Browsers</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {summary.byBrowser.map((b) => (
                    <Bar key={b.browser} label={b.browser} value={b._count.browser} max={summary.byBrowser[0]._count.browser} color="linear-gradient(90deg, #ec4899, #db2777)" />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 12, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Recent Visitors</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["IP", "Location", "Page", "Device", "Browser", "Time on Page", "Type", "When"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#555", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentVisitors.map((v, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "12px 12px", color: "#aaa" }}>{v.ip}</td>
                        <td style={{ padding: "12px 12px", color: "#ccc" }}>{v.city}, {v.country}</td>
                        <td style={{ padding: "12px 12px", color: "#888", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.path}</td>
                        <td style={{ padding: "12px 12px", color: "#aaa", textTransform: "capitalize" }}>{v.deviceType}</td>
                        <td style={{ padding: "12px 12px", color: "#aaa", textTransform: "capitalize" }}>{v.browser}</td>
                        <td style={{ padding: "12px 12px", color: "#888" }}>{v.timeOnPage ? formatTime(v.timeOnPage) : "—"}</td>
                        <td style={{ padding: "12px 12px" }}>
                          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: v.isNew ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)", color: v.isNew ? "#10b981" : "#818cf8" }}>
                            {v.isNew ? "New" : "Return"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 12px", color: "#555" }}>{timeAgo(v.visitedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}