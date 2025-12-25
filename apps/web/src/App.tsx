import { useEffect, useMemo, useState } from "react";

type OpsItem = {
  id: string;
  title: string;
  description: string;
  system?: string;
  env?: string;
  status: "pending" | "analyzed" | "failed";
  analysis?: {
    summary?: string;
    category?: string;
    severity?: number;
    tags?: string[];
    nextSteps?: string[];
  };
  createdAt: string;
  updatedAt: string;
};

const API_BASE = "/api";
const API_KEY = import.meta.env.VITE_API_KEY;

export default function App() {
  const [items, setItems] = useState<OpsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("eddp");
  const [env, setEnv] = useState("dev");

  const canSubmit = useMemo(() => title.trim() && description.trim(), [title, description]);

  async function loadItems() {
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/items`, {
        method: "GET",
        headers: {
          "content-type": "application/json",
          "x-api-key": API_KEY,
        }
      });
      const data = await r.json();
      setItems(data.items ?? []);
    } catch (e: any) {
      setErr("Failed to load items");
    }
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/items`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ title, description, system, env }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t);
      }
      setTitle("");
      setDescription("");
      await loadItems();
    } catch (e: any) {
      setErr("Failed to create item");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
    const t = setInterval(loadItems, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ marginBottom: 6 }}>OpsCopilot (MVP)</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Create an ops item → it gets queued → Python analyzer generates a stub analysis → UI updates.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <form onSubmit={createItem} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>New item</h2>

          <label style={{ display: "block", fontSize: 12, color: "#666" }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 504 from APIM"
            style={{ width: "100%", padding: 10, margin: "6px 0 12px", borderRadius: 8, border: "1px solid #ccc" }}
          />

          <label style={{ display: "block", fontSize: 12, color: "#666" }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? Any context/log snippet?"
            rows={6}
            style={{ width: "100%", padding: 10, margin: "6px 0 12px", borderRadius: 8, border: "1px solid #ccc" }}
          />

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, color: "#666" }}>System</label>
              <input
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                style={{ width: "100%", padding: 10, margin: "6px 0 12px", borderRadius: 8, border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, color: "#666" }}>Env</label>
              <input
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                style={{ width: "100%", padding: 10, margin: "6px 0 12px", borderRadius: 8, border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #222",
              background: loading ? "#eee" : "#111",
              color: loading ? "#555" : "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating..." : "Create"}
          </button>

          {err && <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>}
        </form>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginTop: 0 }}>Items</h2>
            <button onClick={loadItems} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #aaa", background: "#fff" }}>
              Refresh
            </button>
          </div>

          {items.length === 0 ? (
            <p style={{ color: "#666" }}>No items yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((it) => (
                <div key={it.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>{it.title}</strong>
                    <span style={{ fontSize: 12, color: it.status === "analyzed" ? "green" : "#666" }}>
                      {it.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                    {it.system ?? "-"} • {it.env ?? "-"} • {new Date(it.createdAt).toLocaleString()}
                  </div>

                  <p style={{ marginBottom: 8 }}>{it.description}</p>

                  {it.analysis?.summary ? (
                    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 12, color: "#555" }}>
                        <strong>AI Summary:</strong> {it.analysis.summary}
                      </div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                        <strong>Severity:</strong> {it.analysis.severity ?? "-"} • <strong>Category:</strong> {it.analysis.category ?? "-"}
                      </div>
                      {it.analysis.tags?.length ? (
                        <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                          <strong>Tags:</strong> {it.analysis.tags.join(", ")}
                        </div>
                      ) : null}
                      {it.analysis.nextSteps?.length ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, color: "#555" }}>
                            <strong>Next steps</strong>
                          </div>
                          <ul style={{ marginTop: 6 }}>
                            {it.analysis.nextSteps.map((s, idx) => (
                              <li key={idx} style={{ fontSize: 12, color: "#444" }}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#888" }}>Waiting for analysis…</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <hr style={{ margin: "24px 0" }} />
      <p style={{ color: "#666", fontSize: 12 }}>
        Local URLs: UI <code>localhost:5173</code> • API <code>localhost:7071</code> • Queue via Azurite
      </p>
    </div>
  );
}
