import { ImageResponse } from "next/og";

export const alt = "InfraWatch AI — AI-powered infrastructure monitoring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0a0a0a",
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px), radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.18), transparent)",
          backgroundSize: "48px 48px, 48px 48px, 100% 100%",
          color: "#fafafa",
          fontFamily: "system-ui",
        }}
      >
        {/* top row: brand mark + status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: "rgba(139, 92, 246, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "#8B5CF6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#10B981",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                fontSize: 24,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(250,250,250,0.7)",
                fontFamily: "monospace",
              }}
            >
              InfraWatch
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              border: "1px solid rgba(16,185,129,0.4)",
              background: "rgba(16,185,129,0.10)",
              color: "#10B981",
              fontFamily: "monospace",
              fontSize: 16,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#10B981",
              }}
            />
            System Online
          </div>
        </div>

        {/* main headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#fafafa",
              maxWidth: 980,
            }}
          >
            AI-powered infrastructure monitoring.
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.35,
              color: "rgba(250,250,250,0.65)",
              maxWidth: 920,
            }}
          >
            MCP · LangGraph multi-agent pipeline · GraphRAG over a Neo4j
            dependency graph.
          </div>
        </div>

        {/* footer chip row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            "Monitor → Analyst → Responder",
            "Prometheus",
            "Grafana",
            "Neo4j",
            "Anthropic · OpenAI · Gemini · DeepSeek · Ollama",
          ].map((chip) => (
            <div
              key={chip}
              style={{
                padding: "10px 18px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                fontFamily: "monospace",
                fontSize: 18,
                letterSpacing: "0.06em",
                color: "rgba(250,250,250,0.75)",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
