const pptxgen = require("pptxgenjs");
const {
  warnIfSlideHasOverlaps,
  warnIfSlideElementsOutOfBounds,
} = require("./pptxgenjs_helpers/layout");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "PJATK";
pptx.subject = "InfraWatch AI technical presentation";
pptx.title = "InfraWatch AI";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US",
};

const C = {
  bg: "08111F",
  bgAlt: "0E1A2B",
  surface: "101D31",
  surface2: "13243E",
  text: "EAF2FF",
  muted: "96A8C3",
  accent: "13D8FF",
  accent2: "52F5C8",
  accent3: "FFB454",
  stroke: "28415F",
};

const L = {
  left: 0.82,
  right: 0.82,
  top: 0.72,
  contentTop: 1.72,
  sectionGap: 0.34,
  panelGap: 0.34,
  colGap: 0.34,
  cardInsetX: 0.36,
  cardInsetY: 0.18,
  cardAccentX: 0.16,
  cardAccentW: 0.08,
};

function applyBase(slide, kicker, title, subtitle) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.42,
    y: 0.34,
    w: 4.3,
    h: 0.06,
    line: { color: C.accent, transparency: 100 },
    fill: { color: C.accent },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55,
    y: 0.6,
    w: 0.12,
    h: 5.95,
    line: { color: C.accent, transparency: 100 },
    fill: { color: C.accent, transparency: 88 },
  });
  if (kicker) {
    slide.addText(kicker, {
      x: L.left,
      y: 0.66,
      w: 4.3,
      h: 0.26,
      fontFace: "Aptos",
      fontSize: 16,
      bold: true,
      color: C.accent,
      margin: 0,
    });
  }
  if (title) {
    slide.addText(title, {
      x: L.left,
      y: 0.98,
      w: 8.4,
      h: 0.5,
      fontFace: "Aptos Display",
      fontSize: 26,
      bold: true,
      color: C.text,
      margin: 0,
    });
  }
  if (subtitle) {
    slide.addText(subtitle, {
      x: L.left,
      y: 1.5,
      w: 8.9,
      h: 0.56,
      fontFace: "Aptos",
      fontSize: 18,
      color: C.muted,
      margin: 0,
      valign: "mid",
    });
  }
}

function addPanel(slide, opts) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rectRadius: 0.08,
    fill: { color: opts.fill || C.surface },
    line: { color: opts.line || C.stroke, pt: opts.linePt || 1.25 },
  });
}

function addCard(slide, opts) {
  addPanel(slide, opts);
  slide.addShape(pptx.ShapeType.rect, {
    x: opts.x + L.cardAccentX,
    y: opts.y + L.cardInsetY,
    w: L.cardAccentW,
    h: opts.h - 0.36,
    line: { color: opts.accent, transparency: 100 },
    fill: { color: opts.accent },
  });
  slide.addText(opts.title, {
    x: opts.x + L.cardInsetX,
    y: opts.y + L.cardInsetY,
    w: opts.w - 0.56,
    h: 0.28,
    fontFace: "Aptos Display",
    fontSize: 20,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText(opts.body, {
    x: opts.x + L.cardInsetX,
    y: opts.y + 0.58,
    w: opts.w - 0.58,
    h: opts.h - 0.78,
    fontFace: "Aptos",
    fontSize: opts.fontSize || 14,
    color: opts.bodyColor || C.muted,
    margin: 0,
    breakLine: false,
    valign: "mid",
  });
}

function addMetricPill(slide, x, y, w, label) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.38,
    rectRadius: 0.08,
    fill: { color: C.surface2 },
    line: { color: C.surface2, transparency: 100 },
  });
  slide.addText(label, {
    x: x + 0.15,
    y: y + 0.08,
    w: w - 0.24,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 13,
    color: C.text,
    margin: 0,
  });
}

function addArrow(slide, x, y) {
  slide.addText("→", {
    x,
    y,
    w: 0.2,
    h: 0.18,
    fontFace: "Aptos Display",
    fontSize: 20,
    bold: true,
    color: C.accent,
    align: "center",
    margin: 0,
  });
}

function buildTitleSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55,
    y: 0.6,
    w: 0.14,
    h: 5.7,
    line: { color: C.accent, transparency: 100 },
    fill: { color: C.accent, transparency: 80 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.78,
    y: 0.9,
    w: 4.5,
    h: 0.08,
    line: { color: C.accent, transparency: 100 },
    fill: { color: C.accent },
  });
  slide.addText("INFRASTRUCTURE MONITORING · AI AGENTS · GRAPHRAG", {
    x: 0.9,
    y: 1.22,
    w: 5.8,
    h: 0.22,
    fontFace: "Aptos",
    fontSize: 16,
    bold: true,
    color: C.accent,
    margin: 0,
  });
  slide.addText("InfraWatch AI", {
    x: 0.9,
    y: 1.8,
    w: 6.0,
    h: 0.58,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText("From observability signals to automated incident response", {
    x: 0.92,
    y: 2.72,
    w: 5.9,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 18,
    color: C.muted,
    margin: 0,
  });
  slide.addText("Capstone technical presentation", {
    x: 0.92,
    y: 3.38,
    w: 3.8,
    h: 0.2,
    fontFace: "Aptos",
    fontSize: 14,
    color: C.text,
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.05,
    y: 1.38,
    w: 3.45,
    h: 3.1,
    rectRadius: 0.08,
    fill: { color: C.bgAlt },
    line: { color: C.stroke, pt: 1.2 },
  });
  slide.addText("Detect", {
    x: 8.5,
    y: 1.84,
    w: 2.0,
    h: 0.22,
    fontFace: "Aptos Display",
    fontSize: 22,
    bold: true,
    color: C.accent,
    align: "center",
    margin: 0,
  });
  slide.addText("Explain", {
    x: 8.5,
    y: 2.48,
    w: 2.0,
    h: 0.22,
    fontFace: "Aptos Display",
    fontSize: 22,
    bold: true,
    color: C.accent2,
    align: "center",
    margin: 0,
  });
  slide.addText("Resolve", {
    x: 8.5,
    y: 3.12,
    w: 2.0,
    h: 0.22,
    fontFace: "Aptos Display",
    fontSize: 22,
    bold: true,
    color: C.accent3,
    align: "center",
    margin: 0,
  });
  slide.addText("Monitor   →   Analyst   →   Responder", {
    x: 8.22,
    y: 3.94,
    w: 3.0,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 13,
    color: C.muted,
    align: "center",
    margin: 0,
  });
  return slide;
}

function buildOverview() {
  const slide = pptx.addSlide();
  applyBase(
    slide,
    "SYSTEM OVERVIEW",
    "Three agents, one incident loop",
    ""
  );
  slide.addText("From signals to action.", {
    x: L.left,
    y: L.contentTop,
    w: 4.6,
    h: 0.28,
    fontFace: "Aptos Display",
    fontSize: 20,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText("Monitor detects anomalies via Prometheus/Grafana. Analyst reasons over a Neo4j graph. Responder returns a concrete remediation plan.", {
    x: L.left,
    y: 2.1,
    w: 5.7,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 14,
    color: C.muted,
    margin: 0,
  });
  slide.addText("Detect  →  Explain  →  Resolve", {
    x: 8.05,
    y: 1.9,
    w: 3.15,
    h: 0.22,
    fontFace: "Aptos Display",
    fontSize: 18,
    bold: true,
    color: C.text,
    align: "center",
    margin: 0,
  });
  slide.addText("Monitor, Analyst, and Responder act as one incident-handling loop.", {
    x: 8.02,
    y: 2.26,
    w: 3.2,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 13,
    color: C.muted,
    align: "center",
    margin: 0,
  });

  addCard(slide, {
    x: 0.72,
    y: 3.16,
    w: 3.72,
    h: 1.56,
    title: "Monitor",
    accent: C.accent,
    body: "Prometheus + Grafana\nDetect anomalies\nand SLO drift",
  });
  addCard(slide, {
    x: 4.79,
    y: 3.16,
    w: 3.72,
    h: 1.56,
    title: "Analyst",
    accent: C.accent2,
    body: "Neo4j GraphRAG\nTrace blast radius\nthrough graph context",
  });
  addCard(slide, {
    x: 8.86,
    y: 3.16,
    w: 3.72,
    h: 1.56,
    title: "Responder",
    accent: C.accent3,
    body: "Runbook-guided planning\nGenerate next steps\nfor operators",
  });

  addPanel(slide, { x: 0.72, y: 5.46, w: 11.88, h: 0.5, fill: C.bgAlt });
  slide.addText(
    "Prometheus + Grafana  →  MCP Tool Servers  →  LangGraph Agents  →  FastAPI SSE  →  Next.js Dashboard",
    {
      x: 0.95,
      y: 5.61,
      w: 11.4,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 14,
      bold: true,
      color: C.text,
      align: "center",
      margin: 0,
    }
  );
  return slide;
}

function buildMetricsSlide() {
  const slide = pptx.addSlide();
  applyBase(
    slide,
    "",
    "Grafana & Prometheus",
    ""
  );

  addPanel(slide, { x: 0.72, y: 1.64, w: 5.72, h: 4.48 });
  slide.addText("Realtime service telemetry", {
    x: 1.0,
    y: 1.92,
    w: 2.8,
    h: 0.24,
    fontFace: "Aptos Display",
    fontSize: 18,
    bold: true,
    color: C.text,
    margin: 0,
  });

  addCard(slide, {
    x: 1.0,
    y: 2.42,
    w: 1.55,
    h: 1.25,
    title: "Latency",
    accent: C.accent,
    body: "P95 / P99\nSLO drift",
    fontSize: 13,
  });
  addCard(slide, {
    x: 2.72,
    y: 2.42,
    w: 1.55,
    h: 1.25,
    title: "Error Rate",
    accent: C.accent3,
    body: "5xx spikes\nAlert state",
    fontSize: 13,
  });
  addCard(slide, {
    x: 4.44,
    y: 2.42,
    w: 1.55,
    h: 1.25,
    title: "Throughput",
    accent: C.accent2,
    body: "RPS trends\nTraffic drops",
    fontSize: 13,
  });

  slide.addText("Monitored microservices", {
    x: 1.0,
    y: 3.96,
    w: 2.8,
    h: 0.2,
    fontFace: "Aptos",
    fontSize: 14,
    color: C.muted,
    bold: true,
    margin: 0,
  });
  addMetricPill(slide, 1.0, 4.3, 4.84, "API Gateway   ·   User Service   ·   Order Service");
  addMetricPill(slide, 1.0, 4.8, 4.2, "Payment Service   ·   Redis Cache");

  addPanel(slide, { x: 6.72, y: 1.64, w: 5.88, h: 4.48 });
  slide.addText("MCP server exposes Grafana to agents", {
    x: 7.0,
    y: 1.92,
    w: 4.95,
    h: 0.3,
    fontFace: "Aptos Display",
    fontSize: 18,
    bold: true,
    color: C.text,
    margin: 0,
  });

  slide.addText(
    [
      { text: "list_dashboards", options: { bold: true, color: C.text } },
      { text: "\n" },
      { text: "get_panel", options: { bold: true, color: C.text } },
      { text: "\n" },
      { text: "list_alerts", options: { bold: true, color: C.text } },
      { text: "\n\n" },
      {
        text: "Agents query dashboards directly.",
        options: { bold: true, color: C.text },
      },
    ],
    {
      x: 7.0,
      y: 2.48,
      w: 4.92,
      h: 1.6,
      fontFace: "Aptos",
      fontSize: 16,
      margin: 0,
      breakLine: false,
      valign: "top",
    }
  );

  addPanel(slide, { x: 7.0, y: 4.74, w: 5.08, h: 0.82, fill: C.bgAlt });
  slide.addText("Metrics become structured context for the Monitor agent.", {
    x: 7.2,
    y: 4.99,
    w: 4.7,
    h: 0.2,
    fontFace: "Aptos",
    fontSize: 14,
    color: C.text,
    margin: 0,
  });
  return slide;
}

function buildNeo4jSlide() {
  const slide = pptx.addSlide();
  applyBase(
    slide,
    "",
    "Neo4j Knowledge Graph",
    ""
  );

  addPanel(slide, { x: 0.72, y: 1.64, w: 6.08, h: 4.52 });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 2.8,
    y: 2.98,
    w: 1.95,
    h: 0.9,
    rectRadius: 0.08,
    fill: { color: C.accent, transparency: 82 },
    line: { color: C.accent, pt: 1.25 },
  });
  slide.addText("Neo4j", {
    x: 3.14,
    y: 3.28,
    w: 1.25,
    h: 0.2,
    fontFace: "Aptos Display",
    fontSize: 22,
    bold: true,
    color: C.text,
    align: "center",
    margin: 0,
  });

  const nodes = [
    { x: 1.22, y: 2.12, title: "Services", line: C.accent2 },
    { x: 4.78, y: 2.12, title: "Runbooks", line: C.accent },
    { x: 1.22, y: 4.0, title: "Incidents", line: C.accent3 },
    { x: 4.78, y: 4.0, title: "Symptoms", line: C.accent2 },
  ];
  nodes.forEach((n) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: n.x,
      y: n.y,
      w: 1.54,
      h: 0.82,
      rectRadius: 0.08,
      fill: { color: C.surface2 },
      line: { color: n.line, pt: 1.25 },
    });
    slide.addText(n.title, {
      x: n.x + 0.16,
      y: n.y + 0.24,
      w: 1.22,
      h: 0.18,
      fontFace: "Aptos Display",
      fontSize: 18,
      bold: true,
      color: C.text,
      align: "center",
      margin: 0,
    });
  });

  slide.addText(
    "DEPENDS_ON  ·  CALLS  ·  ROUTES_TO  ·  APPLIES_TO  ·  ROOT_CAUSE_IN  ·  HAD_SYMPTOM",
    {
      x: 1.0,
      y: 5.42,
      w: 5.5,
      h: 0.16,
      fontFace: "Aptos",
      fontSize: 11,
      color: C.muted,
      align: "center",
      margin: 0,
    }
  );

  addPanel(slide, { x: 6.98, y: 1.64, w: 5.62, h: 4.52 });
  slide.addText("Why the graph matters", {
    x: 7.26,
    y: 1.92,
    w: 4.7,
    h: 0.24,
    fontFace: "Aptos Display",
    fontSize: 18,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText(
    "Topology edges connect services and blast radius\nOperational edges connect incidents, symptoms, and runbooks\n384-dim embeddings enable vector search inside Neo4j",
    {
      x: 7.26,
      y: 2.48,
      w: 4.95,
      h: 1.5,
      fontFace: "Aptos",
      fontSize: 15,
      color: C.muted,
      margin: 0,
      breakLine: false,
      valign: "mid",
    }
  );
  addPanel(slide, { x: 7.26, y: 4.82, w: 4.95, h: 0.74, fill: C.bgAlt });
  slide.addText("One store for topology, incidents, and operational knowledge.", {
    x: 7.48,
    y: 5.04,
    w: 4.45,
    h: 0.16,
    fontFace: "Aptos",
    fontSize: 14,
    color: C.text,
    margin: 0,
  });
  return slide;
}

function buildCompareSlide() {
  const slide = pptx.addSlide();
  applyBase(
    slide,
    "",
    "RAG vs GraphRAG",
    ""
  );

  addPanel(slide, { x: 0.72, y: 1.72, w: 11.88, h: 0.58, fill: C.bgAlt });
  slide.addText("Both approaches use the same embedding model and the same vector indexes.", {
    x: 1.0,
    y: 1.92,
    w: 11.3,
    h: 0.16,
    fontFace: "Aptos",
    fontSize: 15,
    color: C.text,
    align: "center",
    margin: 0,
  });

  addPanel(slide, { x: 0.72, y: 2.58, w: 5.7, h: 2.62 });
  addPanel(slide, { x: 6.9, y: 2.58, w: 5.7, h: 2.62, line: C.accent2, linePt: 1.6 });
  slide.addText("Naive RAG", {
    x: 1.0,
    y: 2.9,
    w: 2.0,
    h: 0.24,
    fontFace: "Aptos Display",
    fontSize: 20,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText("GraphRAG", {
    x: 7.18,
    y: 2.9,
    w: 2.2,
    h: 0.24,
    fontFace: "Aptos Display",
    fontSize: 20,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText(
    "Flat similarity search\nHigh document overlap\nWeak service awareness",
    {
      x: 1.0,
      y: 3.42,
      w: 4.9,
      h: 1.24,
      fontFace: "Aptos",
      fontSize: 16,
      color: C.muted,
      margin: 0,
      breakLine: false,
      valign: "mid",
    }
  );
  slide.addText(
    "Adds graph traversals\nReturns dependencies and runbooks\nProduces topology-aware answers",
    {
      x: 7.18,
      y: 3.42,
      w: 4.9,
      h: 1.24,
      fontFace: "Aptos",
      fontSize: 16,
      color: C.muted,
      margin: 0,
      breakLine: false,
      valign: "mid",
    }
  );

  addCard(slide, {
    x: 0.94,
    y: 5.46,
    w: 3.45,
    h: 0.72,
    title: "80%+",
    accent: C.accent,
    body: "document overlap",
    fontSize: 13,
    bodyColor: C.text,
  });
  addCard(slide, {
    x: 4.67,
    y: 5.46,
    w: 3.35,
    h: 0.72,
    title: "6-10",
    accent: C.accent2,
    body: "extra relationship fields",
    fontSize: 13,
    bodyColor: C.text,
  });
  addCard(slide, {
    x: 8.3,
    y: 5.46,
    w: 3.35,
    h: 0.72,
    title: "Outcome",
    accent: C.accent3,
    body: "topology-aware answers",
    fontSize: 13,
    bodyColor: C.text,
  });
  return slide;
}

function buildArchitectureSlide() {
  const slide = pptx.addSlide();
  applyBase(
    slide,
    "",
    "Architecture",
    ""
  );
  slide.addText("The system closes the loop automatically.", {
    x: L.left,
    y: L.contentTop,
    w: 5.5,
    h: 0.28,
    fontFace: "Aptos Display",
    fontSize: 20,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText("Metrics trigger detection, graph reasoning explains impact, and the responder produces the next best action for operators.", {
    x: L.left,
    y: 2.1,
    w: 6.5,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 14,
    color: C.muted,
    margin: 0,
  });

  addPanel(slide, { x: 0.72, y: 2.76, w: 11.88, h: 1.72 });
  addCard(slide, {
    x: 0.95,
    y: 3.01,
    w: 1.98,
    h: 1.18,
    title: "1. Metrics",
    accent: C.accent,
    body: "Prometheus\nGrafana dashboards",
    fontSize: 13,
  });
  addArrow(slide, 3.05, 3.28);
  addCard(slide, {
    x: 3.32,
    y: 3.01,
    w: 2.08,
    h: 1.18,
    title: "2. MCP Layer",
    accent: C.accent2,
    body: "Prometheus\nGrafana\nNeo4j",
    fontSize: 13,
  });
  addArrow(slide, 5.51, 3.28);
  addCard(slide, {
    x: 5.88,
    y: 3.01,
    w: 2.18,
    h: 1.18,
    title: "3. LangGraph",
    accent: C.accent3,
    body: "Monitor\nAnalyst + GraphRAG\nResponder",
    fontSize: 13,
  });
  addArrow(slide, 8.12, 3.28);
  addCard(slide, {
    x: 8.53,
    y: 3.01,
    w: 1.8,
    h: 1.18,
    title: "4. Delivery",
    accent: C.accent,
    body: "FastAPI\nSSE streaming",
    fontSize: 13,
  });
  addArrow(slide, 10.38, 3.28);
  addCard(slide, {
    x: 10.78,
    y: 3.01,
    w: 1.72,
    h: 1.18,
    title: "5. UI",
    accent: C.accent2,
    body: "Next.js\nLive dashboard",
    fontSize: 13,
  });

  addPanel(slide, { x: 0.72, y: 4.96, w: 11.88, h: 0.96, fill: C.bgAlt });
  slide.addText(
    "InfraWatch AI turns telemetry into operational decisions in one automated flow.",
    {
      x: 1.0,
      y: 5.16,
      w: 11.25,
      h: 0.22,
      fontFace: "Aptos Display",
      fontSize: 18,
      bold: true,
      color: C.text,
      align: "center",
      margin: 0,
    }
  );
  slide.addText(
    "Anomaly detected  →  blast radius traced  →  incidents and runbooks matched  →  remediation plan delivered",
    {
      x: 1.0,
      y: 5.48,
      w: 11.25,
      h: 0.18,
      fontFace: "Aptos",
      fontSize: 13,
      color: C.muted,
      align: "center",
      margin: 0,
    }
  );
  return slide;
}

function buildThankYouSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.65,
    y: 0.88,
    w: 11.0,
    h: 0.08,
    line: { color: C.accent2, transparency: 100 },
    fill: { color: C.accent2, transparency: 20 },
  });
  slide.addText("Thank you", {
    x: 0.95,
    y: 2.04,
    w: 4.3,
    h: 0.52,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: C.text,
    margin: 0,
  });
  slide.addText("InfraWatch AI", {
    x: 1.0,
    y: 2.9,
    w: 3.5,
    h: 0.24,
    fontFace: "Aptos",
    fontSize: 18,
    color: C.accent,
    margin: 0,
  });
  slide.addText("AI-powered infrastructure monitoring for microservice incident response", {
    x: 1.0,
    y: 3.34,
    w: 5.5,
    h: 0.24,
    fontFace: "Aptos",
    fontSize: 15,
    color: C.muted,
    margin: 0,
  });
  slide.addText("Questions?", {
    x: 8.35,
    y: 3.08,
    w: 2.0,
    h: 0.24,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: C.text,
    align: "center",
    margin: 0,
  });
  return slide;
}

function validateSlides() {
  pptx._slides.forEach((slide) => {
    warnIfSlideHasOverlaps(slide, pptx, {
      muteContainment: true,
      ignoreDecorativeShapes: true,
    });
    warnIfSlideElementsOutOfBounds(slide, pptx);
  });
}

async function main() {
  buildTitleSlide();
  buildOverview();
  buildMetricsSlide();
  buildNeo4jSlide();
  buildCompareSlide();
  buildArchitectureSlide();
  buildThankYouSlide();
  validateSlides();
  const out = "/Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/docs/InfraWatch_AI_Tech_Deck.pptx";
  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
