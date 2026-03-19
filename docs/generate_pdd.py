"""Generate InfraWatch AI Project Design Document (PDD) as a PDF.

Formal academic document — white background, black text, no decorative elements.
Follows the PDD template structure exactly (10 sections).
Content is written in design/intent tense (project not yet implemented).
"""

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── Colour palette ─────────────────────────────────────────────────────────────
WHITE   = colors.HexColor("#FFFFFF")
DARK    = colors.HexColor("#1A1A1A")
HEADING = colors.HexColor("#1A3A5C")
SUBHEAD = colors.HexColor("#2E5C8A")
RULE    = colors.HexColor("#CCCCCC")
TH_BG   = colors.HexColor("#E8EEF4")
ROW_ALT = colors.HexColor("#F5F7FA")
BORDER  = colors.HexColor("#B0BEC5")
MUTED   = colors.HexColor("#666666")

PAGE_W, PAGE_H = A4
MARGIN    = 2.5 * cm
CONTENT_W = PAGE_W - 2 * MARGIN  # ≈ 453 pts / 16 cm

# ── Cell paragraph styles ──────────────────────────────────────────────────────
_CELL_H = ParagraphStyle(
    "CellH",
    fontName="Helvetica-Bold",
    fontSize=8.5,
    leading=11,
    textColor=HEADING,
    wordWrap="LTR",
)
_CELL_B = ParagraphStyle(
    "CellB",
    fontName="Helvetica",
    fontSize=8.5,
    leading=12,
    textColor=DARK,
    wordWrap="LTR",
)
# Single-line header style — used for short, fixed-width header cells that
# must never break across lines.  Keep font small enough to guarantee fit.
_CELL_H1 = ParagraphStyle(
    "CellH1",
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=HEADING,
    wordWrap="LTR",
)


def tc(text, header=False, nowrap=False):
    """Wrap a string in a Paragraph so ReportLab word-wraps it inside the cell."""
    style = _CELL_H1 if nowrap else (_CELL_H if header else _CELL_B)
    return Paragraph(str(text), style)


def _wrap_rows(rows, nowrap_header=False):
    out = []
    for i, row in enumerate(rows):
        is_header = i == 0
        out.append([tc(cell, header=is_header, nowrap=(is_header and nowrap_header))
                    for cell in row])
    return out


# ── Document styles ────────────────────────────────────────────────────────────

def _styles():
    def s(name, **kw):
        return ParagraphStyle(name, **kw)

    return {
        "title": s("T", fontName="Helvetica-Bold", fontSize=24, leading=30,
                   textColor=HEADING, alignment=TA_CENTER, spaceAfter=6),
        "subtitle": s("S", fontName="Helvetica", fontSize=13, leading=18,
                      textColor=DARK, alignment=TA_CENTER, spaceAfter=4),
        "h1": s("H1", fontName="Helvetica-Bold", fontSize=14, leading=18,
                textColor=HEADING, spaceBefore=20, spaceAfter=6),
        "h2": s("H2", fontName="Helvetica-Bold", fontSize=11, leading=15,
                textColor=SUBHEAD, spaceBefore=12, spaceAfter=5),
        "h3": s("H3", fontName="Helvetica-Bold", fontSize=10, leading=14,
                textColor=DARK, spaceBefore=8, spaceAfter=4),
        "body": s("B", fontName="Helvetica", fontSize=9.5, leading=14,
                  textColor=DARK, alignment=TA_JUSTIFY, spaceAfter=6),
        "bullet": s("BL", fontName="Helvetica", fontSize=9.5, leading=13,
                    textColor=DARK, leftIndent=18, spaceAfter=3),
        "accept": s("AC", fontName="Helvetica", fontSize=9, leading=13,
                    textColor=DARK, leftIndent=22, spaceAfter=2),
        "caption": s("CA", fontName="Helvetica-Oblique", fontSize=8, leading=11,
                     textColor=MUTED, alignment=TA_CENTER, spaceAfter=6),
    }


def hr():
    return HRFlowable(width="100%", thickness=0.75, color=RULE,
                      spaceAfter=6, spaceBefore=2)


def p(text, style):
    return Paragraph(text, style)


def b(text, style):
    return Paragraph(f"- {text}", style)


# ── Page template ──────────────────────────────────────────────────────────────

def _make_doc(path):
    doc = BaseDocTemplate(
        path, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN + 0.5 * cm,
        title="InfraWatch AI — Project Design Document",
    )

    def _page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(WHITE)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 1.4 * cm, PAGE_W - MARGIN, 1.4 * cm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(PAGE_W / 2, 0.8 * cm, str(doc.page))
        canvas.restoreState()

    frame = Frame(MARGIN, MARGIN + 0.5 * cm,
                  CONTENT_W, PAGE_H - 2 * MARGIN - 0.5 * cm, id="main")
    doc.addPageTemplates([PageTemplate(id="body", frames=[frame], onPage=_page)])
    return doc


# ── Table helpers ──────────────────────────────────────────────────────────────

def _table(raw_rows, col_widths, nowrap_header=False):
    """Build a styled table; all cells are Paragraph objects for correct wrapping."""
    data = _wrap_rows(raw_rows, nowrap_header=nowrap_header)
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",     (0, 0), (-1, 0),  TH_BG),
        ("BACKGROUND",     (0, 1), (-1, -1), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, ROW_ALT]),
        ("GRID",           (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN",         (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",     (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 5),
        ("LEFTPADDING",    (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",   (0, 0), (-1, -1), 6),
    ]))
    return tbl


def _uc_table(raw_rows):
    label_w = 2.8 * cm
    data = [[tc(r[0], header=True, nowrap=True), tc(r[1])] for r in raw_rows]
    tbl = Table(data, colWidths=[label_w, CONTENT_W - label_w])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, -1), TH_BG),
        ("BACKGROUND",    (1, 0), (1, -1), WHITE),
        ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    return tbl


def _cw(*fractions):
    """Convert fractional proportions (summing to 1.0) to absolute column widths."""
    return [f * CONTENT_W for f in fractions]


# ── Architecture diagram ───────────────────────────────────────────────────────

def _arch_diagram(cw):
    """Return a Drawing flowable showing the layered system architecture."""
    W   = cw
    lh  = 0.92 * cm   # standard layer height
    ah  = 1.22 * cm   # agent layer (taller, holds 3 side-by-side boxes)
    gap = 0.42 * cm   # vertical gap between layers (filled by connectors)
    stp = 0.18 * cm   # section-label strip at top of each layer box
    lm  = 0.10 * cm   # horizontal margin between inner boxes

    # Y positions, bottom-up in ReportLab coordinates
    y_svc   = 0.25 * cm
    y_infra = y_svc   + lh + gap
    y_mcp   = y_infra + lh + gap
    y_agent = y_mcp   + lh + gap
    y_api   = y_agent + ah + gap
    y_ui    = y_api   + lh + gap
    H = y_ui + lh + 0.25 * cm

    d = Drawing(W, H)

    # Diagram palette (local, keeps diagram self-contained)
    _FG   = colors.HexColor("#1A3A5C")
    _MUT  = colors.HexColor("#888888")
    _BOR  = colors.HexColor("#B0BEC5")
    _TH   = colors.HexColor("#E8EEF4")
    _ALT  = colors.HexColor("#F5F7FA")
    _AGT  = colors.HexColor("#EBF2F8")
    _WHT  = colors.HexColor("#FFFFFF")

    def rct(x, y, w, h, fill=_TH, stroke=_BOR, sw=0.5):
        d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=sw))

    def txt(x, y, text, fs=7, bold=False, color=_FG, anchor="middle"):
        d.add(String(x, y, text,
                     fontName="Helvetica-Bold" if bold else "Helvetica",
                     fontSize=fs, fillColor=color, textAnchor=anchor))

    def connector(x, y_from, y_to, lbl=None):
        """Downward arrow from y_from to y_to (y_from > y_to in drawing coords)."""
        ah_sz = 4
        d.add(Line(x, y_from, x, y_to + ah_sz,
                   strokeColor=_MUT, strokeWidth=0.7))
        d.add(Polygon([x - 3, y_to + ah_sz + 1,
                       x + 3, y_to + ah_sz + 1,
                       x,     y_to],
                      fillColor=_MUT, strokeWidth=0))
        if lbl:
            mid_y = (y_from + y_to) / 2 - 3.5
            txt(x + 5, mid_y, lbl, fs=6, color=_MUT, anchor="start")

    def layer(y, h, fill, section_label, items, fill_inner=_WHT):
        """Draw outer box + section label strip + evenly spaced inner item boxes."""
        n = len(items)
        rct(0, y, W, h, fill=fill)
        # Section label strip at top of box
        rct(0, y + h - stp, W, stp, fill=fill, stroke=_BOR, sw=0.3)
        txt(6, y + h - stp / 2 - 2.2, section_label,
            fs=5.5, bold=True, color=_MUT, anchor="start")
        # Inner item boxes
        total_gap = (n + 1) * lm
        iw = (W - total_gap) / n
        ih = h - stp - 2 * lm
        iy = y + lm
        for i, name in enumerate(items):
            ix = lm + i * (iw + lm)
            rct(ix, iy, iw, ih, fill=fill_inner)
            txt(ix + iw / 2, iy + ih / 2 - 3.5, name, fs=7, bold=True)

    col3 = W / 3

    # ── Layer 1: Simulated Microservices (bottom) ──────────────────────────────
    layer(y_svc, lh, _ALT, "SIMULATED MICROSERVICES",
          ["api-gateway", "payment-service", "user-service",
           "order-service", "redis-cache"])

    # ── Layer 2: Infrastructure ────────────────────────────────────────────────
    # Grafana is infrastructure but has no MCP server; omitted from pipeline diagram
    layer(y_infra, lh, _TH, "INFRASTRUCTURE SERVICES",
          ["Prometheus", "Neo4j"])
    # Compute centers for 2-item layers (used for connectors)
    iw2 = (W - 3 * lm) / 2
    ctrs2 = [lm + iw2 / 2, 2 * lm + 3 * iw2 / 2]
    # Arrow: Prometheus scrapes the microservices
    connector(ctrs2[0], y_infra, y_svc + lh, lbl="scrapes")

    # ── Layer 3: MCP Servers ───────────────────────────────────────────────────
    layer(y_mcp, lh, _ALT, "MCP SERVERS  (stdio transport)",
          ["Prometheus MCP", "Neo4j MCP"])
    for cx in ctrs2:
        connector(cx, y_mcp, y_infra + lh)

    # ── Layer 4: LangGraph Agent Pipeline ─────────────────────────────────────
    rct(0, y_agent, W, ah, fill=_AGT)
    rct(0, y_agent + ah - stp, W, stp, fill=_AGT, stroke=_BOR, sw=0.3)
    txt(6, y_agent + ah - stp / 2 - 2.2,
        "LANGGRAPH AGENT PIPELINE", fs=5.5, bold=True, color=_MUT, anchor="start")

    agent_names = ["Monitor Agent", "Analyst Agent", "Responder Agent"]
    aw = (W - 4 * lm) / 3
    ih = ah - stp - 2 * lm
    iy = y_agent + lm
    for i, name in enumerate(agent_names):
        ax = lm + i * (aw + lm)
        rct(ax, iy, aw, ih, fill=_WHT)
        txt(ax + aw / 2, iy + ih / 2 - 3.5, name, fs=7, bold=True)
        if i < 2:
            mid_y = iy + ih / 2
            arr_x0 = ax + aw
            arr_x1 = ax + aw + lm
            d.add(Line(arr_x0, mid_y, arr_x1 - 4, mid_y,
                       strokeColor=_MUT, strokeWidth=0.7))
            d.add(Polygon([arr_x1 - 5, mid_y - 3,
                           arr_x1 - 5, mid_y + 3,
                           arr_x1,     mid_y],
                          fillColor=_MUT, strokeWidth=0))

    for cx in ctrs2:
        connector(cx, y_agent, y_mcp + lh)

    # ── Layer 5: FastAPI Backend ───────────────────────────────────────────────
    rct(0, y_api, W, lh, fill=_TH)
    rct(0, y_api + lh - stp, W, stp, fill=_TH, stroke=_BOR, sw=0.3)
    txt(6, y_api + lh - stp / 2 - 2.2,
        "API LAYER", fs=5.5, bold=True, color=_MUT, anchor="start")
    api_w = W * 0.48
    api_x = (W - api_w) / 2
    rct(api_x, y_api + lm, api_w, lh - stp - 2 * lm, fill=_WHT)
    txt(W / 2, y_api + (lh - stp) / 2 - 3.5, "FastAPI Backend", fs=7, bold=True)
    connector(W / 2, y_api, y_agent + ah, lbl="SSE stream")

    # ── Layer 6: User Interface (top) ──────────────────────────────────────────
    layer(y_ui, lh, _ALT, "USER INTERFACE",
          ["Next.js Dashboard"])
    connector(W / 2, y_ui, y_api + lh, lbl="HTTP / SSE")

    return d


# ── Content builder ────────────────────────────────────────────────────────────

def build_content(S):
    elems = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    elems += [
        Spacer(1, 2.0 * cm),
        p("InfraWatch AI", S["title"]),
        p("Project Design Document", S["subtitle"]),
        hr(),
        Spacer(1, 1.5 * cm),
    ]

    # ── 1. Overview ───────────────────────────────────────────────────────────
    elems += [
        p("1. Overview", S["h1"]), hr(),
        p(
            "<b>InfraWatch AI</b> is an AI-powered infrastructure monitoring and incident "
            "response assistant designed as a PJATK Master's capstone project for the TEG "
            "course. The system is intended to demonstrate how modern AI technologies — "
            "specifically <b>MCP (Model Context Protocol)</b>, <b>LangGraph</b> multi-agent "
            "orchestration, and <b>GraphRAG</b> — can be composed into a coherent, "
            "autonomous DevOps toolchain.",
            S["body"],
        ),
        p(
            "The primary target users are <b>DevOps engineers and Site Reliability Engineers "
            "(SREs)</b> who manage distributed infrastructure and respond to production "
            "incidents. The system aims to reduce mean time to recovery (MTTR) by replacing "
            "manual alert triage with an autonomous pipeline: a Monitor Agent will poll "
            "Prometheus metrics and detect anomalies; an Analyst Agent will traverse a Neo4j "
            "service dependency graph to determine root cause and blast radius; and a "
            "Responder Agent will retrieve relevant runbooks and produce a prioritised "
            "remediation plan. The expected outcome is a functional, demonstrable prototype "
            "that validates GraphRAG's advantage over naive vector retrieval for "
            "topology-dependent knowledge queries.",
            S["body"],
        ),
        p(
            "Core technologies include Python 3.12, LangChain, LangGraph, Anthropic API "
            "(claude-haiku-4-5-20251001) with an optional Ollama local backend, Neo4j 5 "
            "with sentence-transformers embeddings, Prometheus, Grafana, Docker Compose, "
            "FastAPI, and Next.js.",
            S["body"],
        ),
        Spacer(1, 0.3 * cm),
    ]

    # ── 2. Problem Statement ──────────────────────────────────────────────────
    elems += [
        p("2. Problem Statement", S["h1"]), hr(),
        p("<b>Problem</b>", S["h2"]),
        p(
            "Modern distributed systems generate thousands of monitoring events daily. "
            "On-call engineers face several compounding challenges that existing tooling "
            "does not adequately address:",
            S["body"],
        ),
        b(
            "<b>Alert fatigue.</b> Raw metric streams lack contextual meaning. Engineers "
            "must manually correlate alerts across services to assess severity, often "
            "under time pressure.",
            S["bullet"],
        ),
        b(
            "<b>Root-cause ambiguity.</b> A single visible symptom — such as elevated "
            "API latency — may originate from a cascade of upstream failures. Without "
            "graph-topology awareness, the true origin is difficult to identify quickly.",
            S["bullet"],
        ),
        b(
            "<b>Runbook friction.</b> Engineers must manually search disconnected "
            "documentation while managing an active incident. This increases mean time "
            "to recovery and the probability of human error.",
            S["bullet"],
        ),
        p(
            "Existing monitoring tools such as Grafana and PagerDuty surface metrics and "
            "alerts effectively, but do not autonomously reason about dependency topology, "
            "retrieve context-aware remediation procedures, or produce structured, "
            "prioritised action plans. The gap lies between raw observability data and "
            "actionable incident response.",
            S["body"],
        ),
        p("<b>Solution</b>", S["h2"]),
        p(
            "InfraWatch AI proposes an autonomous, graph-aware incident response pipeline "
            "that addresses each limitation above:",
            S["body"],
        ),
        b(
            "Automated anomaly detection by polling Prometheus and comparing metrics "
            "against configurable service thresholds.",
            S["bullet"],
        ),
        b(
            "Graph-based root-cause analysis by traversing Neo4j DEPENDS_ON edges to "
            "identify the origin service and the full blast radius of any detected anomaly.",
            S["bullet"],
        ),
        b(
            "Context-aware knowledge retrieval via GraphRAG, combining vector similarity "
            "search with graph traversal to surface topology-relevant runbooks and "
            "historical incidents.",
            S["bullet"],
        ),
        b(
            "Structured remediation planning that produces a prioritised, runbook-cited "
            "action plan for the affected services.",
            S["bullet"],
        ),
        b(
            "Full reasoning transparency by streaming every agent reasoning step, "
            "tool call, and token to the frontend in real time.",
            S["bullet"],
        ),
        Spacer(1, 0.3 * cm),
    ]

    # ── 3. System Architecture ────────────────────────────────────────────────
    elems += [
        p("3. System Architecture", S["h1"]), hr(),
        p(
            "InfraWatch is structured as a monorepo in six layers that will communicate "
            "via HTTP, Server-Sent Events (SSE), MCP stdio transport, and the Neo4j "
            "Bolt protocol. All components will be containerised and orchestrated via "
            "a single Docker Compose configuration.",
            S["body"],
        ),
        p("<b>3.1 Architecture Diagram</b>", S["h2"]),
        _arch_diagram(CONTENT_W),
        p(
            "Figure 1. Layered system architecture. Arrows indicate the primary direction "
            "of communication. MCP servers sit between the agent pipeline and the "
            "infrastructure services, providing a structured tool interface via stdio.",
            S["caption"],
        ),
        p("<b>3.2 Component Descriptions</b>", S["h2"]),
    ]

    elems.append(_table(
        [
            ["Layer", "Technology", "Role"],
            ["Next.js Frontend",
             "Next.js 16, shadcn/ui, TanStack Query",
             "Primary Mission Control dashboard; streams agent output via SSE (port 3001)"],
            ["FastAPI Backend",
             "FastAPI, asyncio, SSE",
             "Pipeline proxy; exposes the run endpoint and streams events to the frontend (port 8090)"],
            ["LangGraph Pipeline",
             "LangGraph, LangChain",
             "Orchestrates Monitor, Analyst, and Responder agents in a directed graph"],
            ["MCP Servers",
             "FastMCP, stdio transport",
             "Two domain-specific servers wrapping Prometheus and Neo4j APIs"],
            ["Simulated Services",
             "FastAPI (5 microservices)",
             "Synthetic microservices emitting realistic Prometheus metrics (ports 8001-8004, 8080)"],
            ["Prometheus",
             "Prometheus 2.x",
             "Metrics collection and storage; scraped every 15 seconds (port 9090)"],
            ["Grafana",
             "Grafana 10",
             "Dashboard visualisation with pre-provisioned datasource (port 3000)"],
            ["Neo4j",
             "Neo4j 5, sentence-transformers",
             "Topology graph and GraphRAG knowledge base with native vector index (port 7687)"],
        ],
        col_widths=_cw(0.27, 0.33, 0.40),
        nowrap_header=True,
    ))
    elems.append(Spacer(1, 0.3 * cm))

    elems += [
        p("<b>3.3 Data Flow</b>", S["h2"]),
        p(
            "1. Simulated microservices expose <code>/metrics</code> endpoints that "
            "Prometheus scrapes on a 15-second interval.",
            S["body"],
        ),
        p(
            "2. The user triggers the agent pipeline via the frontend dashboard, "
            "which calls the FastAPI backend endpoint.",
            S["body"],
        ),
        p(
            "3. The FastAPI backend launches the LangGraph pipeline, which establishes "
            "connections to the MCP servers for the duration of the run.",
            S["body"],
        ),
        p(
            "4. Each agent issues tool calls routed to the appropriate MCP server "
            "(Prometheus MCP or Neo4j MCP). Results are returned to the agent "
            "for the next reasoning step.",
            S["body"],
        ),
        p(
            "5. Every token and tool-call event is emitted as an SSE event by FastAPI "
            "and rendered live in the Next.js frontend.",
            S["body"],
        ),
    ]

    # ── 4. AI System Design ───────────────────────────────────────────────────
    elems += [
        p("4. AI System Design", S["h1"]), hr(),

        p("<b>4.1 Language Model</b>", S["h2"]),
        p(
            "The default language model will be <b>claude-haiku-4-5-20251001</b>, "
            "accessed via the Anthropic API. This model is selected for its low "
            "inference cost, fast throughput, and sufficient capability for structured "
            "multi-step tool calling. A local Ollama backend will be supported as an "
            "alternative, enabling offline or cost-free usage.",
            S["body"],
        ),
    ]

    elems.append(_table(
        [
            ["Parameter", "Value"],
            ["Default model",       "claude-haiku-4-5-20251001  (Anthropic API)"],
            ["Local alternative",   "Ollama — any model with at least 14B parameters (e.g. qwen2.5:14b)"],
            ["Backend selection",   "Runtime flag: llm_provider = anthropic | ollama; also configurable via UI sidebar"],
            ["Token budget",        "30,000 TPM (Anthropic free tier) — tool results will be truncated to 3,000 characters"],
            ["Tool-call rounds",    "Monitor: 3  |  Analyst: 4  |  Responder: 3"],
        ],
        col_widths=_cw(0.33, 0.67),
        nowrap_header=True,
    ))
    elems.append(Spacer(1, 0.3 * cm))

    elems += [
        p("<b>4.2 Retrieval System</b>", S["h2"]),
        p(
            "The system will implement a GraphRAG retrieval pipeline that augments "
            "standard vector similarity search with Cypher graph traversal over the "
            "Neo4j topology. This design allows the Analyst Agent to retrieve not only "
            "semantically relevant documents but also topology-contextualised knowledge "
            "such as upstream service dependencies and blast radius information.",
            S["body"],
        ),
        b(
            "<b>Embedding model:</b> sentence-transformers/all-MiniLM-L6-v2, "
            "running locally on CPU. Embeddings are computed once at ingestion time "
            "and stored as vector properties on Neo4j nodes. The Anthropic API is "
            "not used for embeddings.",
            S["bullet"],
        ),
        b(
            "<b>Vector index:</b> Neo4j native vector index on Runbook and Incident "
            "node types, using cosine similarity.",
            S["bullet"],
        ),
        b(
            "<b>Chunking strategy:</b> Each runbook will be stored as a single Neo4j "
            "node (estimated average of approximately 400 tokens). Incident reports "
            "will be stored verbatim.",
            S["bullet"],
        ),
        b(
            "<b>Retrieval:</b> Cosine similarity top-k=5, combined with Cypher "
            "traversal of DEPENDS_ON edges. Results will include both document "
            "content and structural topology context.",
            S["bullet"],
        ),
        b(
            "<b>Naive RAG baseline:</b> Pure vector similarity without graph "
            "traversal, used as a comparison baseline in the evaluation module.",
            S["bullet"],
        ),
        Spacer(1, 0.2 * cm),

        p("<b>4.3 Graph and Structured Knowledge</b>", S["h2"]),
        p(
            "Neo4j will serve as both the infrastructure topology store and the "
            "GraphRAG knowledge base. The topology is populated by a seed script; "
            "runbooks and incidents are ingested separately with embeddings.",
            S["body"],
        ),
        b("Database: Neo4j 5, Bolt protocol on localhost:7687", S["bullet"]),
        b("Node types: Service, Runbook, Incident, Symptom", S["bullet"]),
        b("Relationships: DEPENDS_ON (topology), HAS_RUNBOOK, RELATED_TO_INCIDENT", S["bullet"]),
        b(
            "Planned scale: 5 service nodes, 7 DEPENDS_ON edges, 15 runbook nodes, "
            "20 incident nodes, approximately 30 symptom nodes",
            S["bullet"],
        ),
        Spacer(1, 0.2 * cm),

        p("<b>4.4 Agents</b>", S["h2"]),
        p(
            "The pipeline will consist of three specialised agents, each with a "
            "defined role, a specific set of MCP tools, and bounded tool-call rounds "
            "to control token usage:",
            S["body"],
        ),
    ]

    elems.append(_table(
        [
            ["Agent", "Role", "Tools", "Output"],
            [
                "Monitor",
                "Detect metric anomalies against configurable per-service thresholds",
                "execute_promql, list_metrics, get_targets",
                "Strict JSON block: list of anomalies with service, metric, value, "
                "threshold, and severity fields. Malformed output is rejected.",
            ],
            [
                "Analyst",
                "Trace root cause and blast radius via the Neo4j dependency graph "
                "and the runbook / incident corpus",
                "run_cypher, get_service_dependencies, get_blast_radius, "
                "search_runbooks, find_similar_incidents",
                "Structured analysis naming the root-cause service, all affected "
                "services, and the most relevant runbook identifiers",
            ],
            [
                "Responder",
                "Produce a prioritised, actionable remediation plan",
                "get_runbook_for_service, search_knowledge_base",
                "Step-by-step remediation plan with explicit references to "
                "runbook IDs for each affected service",
            ],
        ],
        col_widths=_cw(0.14, 0.26, 0.30, 0.30),
        nowrap_header=True,
    ))
    elems.append(Spacer(1, 0.3 * cm))

    elems += [
        p("<b>4.5 Workflow</b>", S["h2"]),
        p(
            "When a user initiates the pipeline, the system will process the request "
            "through the following stages:",
            S["body"],
        ),
        p(
            "1. <b>Trigger.</b> The user clicks Run Pipeline in the dashboard.",
            S["body"],
        ),
        p(
            "2. <b>Monitoring.</b> The Monitor Agent polls Prometheus via MCP, "
            "evaluates current metric values against thresholds, and produces a "
            "validated JSON anomaly list. Any output that does not conform to the "
            "expected schema will be rejected and the agent retried.",
            S["body"],
        ),
        p(
            "3. <b>Analysis.</b> The Analyst Agent receives the anomaly list, queries "
            "the Neo4j graph for service dependencies and blast radius, and retrieves "
            "the most relevant runbooks and historical incidents using GraphRAG.",
            S["body"],
        ),
        p(
            "4. <b>Response generation.</b> The Responder Agent receives the analysis, "
            "fetches full runbook content for all affected services, and constructs a "
            "structured remediation plan.",
            S["body"],
        ),
        p(
            "5. <b>Streaming output.</b> Every token and tool-call event is emitted "
            "via SSE as it is produced. The frontend renders output grouped by agent "
            "node, with tool call names and truncated results visible inline.",
            S["body"],
        ),
        Spacer(1, 0.3 * cm),
    ]

    # ── 5. Data Sources ───────────────────────────────────────────────────────
    elems += [
        p("5. Data Sources", S["h1"]), hr(),
        p(
            "The system will consume the following data sources. All static knowledge "
            "data will be seeded prior to the demonstration. Live metric data will be "
            "queried dynamically during each pipeline run.",
            S["body"],
        ),
    ]

    elems.append(_table(
        [
            ["Source", "Format", "Purpose", "Size / Processing"],
            ["Prometheus metrics",
             "PromQL / HTTP REST",
             "Real-time health indicators for all simulated services",
             "5 services x ~8 metrics each; queried live via Prometheus MCP"],
            ["Grafana dashboards",
             "JSON REST API",
             "Dashboard and panel data for human inspection via the Grafana web interface",
             "4 pre-provisioned dashboards; not queried by the agent pipeline"],
            ["Runbooks",
             "YAML, loaded into Neo4j",
             "Service-specific remediation procedures for the Analyst and Responder agents",
             "15 nodes; embeddings computed by all-MiniLM-L6-v2 at ingestion time"],
            ["Incident reports",
             "YAML, loaded into Neo4j",
             "Historical incident corpus used for similarity search during analysis",
             "20 nodes; stored verbatim with embeddings"],
            ["Symptom data",
             "YAML, loaded into Neo4j",
             "Symptom-to-service classification used to enrich the knowledge graph",
             "Approx. 30 nodes; linked to Service nodes"],
            ["Service topology",
             "Python seed script",
             "Directed dependency graph defining upstream/downstream service relationships",
             "5 Service nodes, 7 DEPENDS_ON edges; seeded once"],
        ],
        col_widths=_cw(0.20, 0.17, 0.34, 0.29),
        nowrap_header=True,
    ))
    elems.append(Spacer(1, 0.3 * cm))

    # ── 6. User Stories ───────────────────────────────────────────────────────
    elems += [p("6. User Stories", S["h1"]), hr()]

    stories = [
        (
            "US-01 — Monitor Infrastructure Health",
            "As a DevOps engineer, I want to view real-time health metrics for all "
            "services so that I can identify degradations before they become incidents.",
            ["The dashboard refreshes on a configurable interval.",
             "P95 latency, error rate, and cache hit ratio are shown per service.",
             "Metrics breaching SLO thresholds are visually highlighted."],
        ),
        (
            "US-02 — Inject Synthetic Anomalies",
            "As a QA engineer, I want to inject synthetic failure scenarios so that "
            "I can verify that the pipeline detects and diagnoses them correctly.",
            ["Cascade, latency, error-rate, and cache-failure presets are available.",
             "An injected anomaly becomes visible in Prometheus within one scrape cycle.",
             "A reset action restores all services to their healthy baseline."],
        ),
        (
            "US-03 — Run the Agent Pipeline",
            "As a site reliability engineer, I want to trigger the AI pipeline and "
            "observe live output so that I can understand each agent's reasoning.",
            ["The pipeline streams tokens and tool calls in real time.",
             "Each agent's output section is visually separated.",
             "Runbook identifiers cited by the Responder are expandable."],
        ),
        (
            "US-04 — View the Service Dependency Graph",
            "As a platform engineer, I want to visualise the service topology so that "
            "I can understand the blast radius for any given service.",
            ["An interactive force-directed dependency graph is rendered.",
             "Selecting a node highlights its downstream blast radius.",
             "Node colour reflects the current health status of that service."],
        ),
        (
            "US-05 — Compare GraphRAG and Naive RAG",
            "As a researcher, I want to run the evaluation suite and view side-by-side "
            "scores so that I can quantify GraphRAG's structural advantage.",
            ["Ten benchmark queries are executed against both retrieval methods.",
             "LLM-as-judge scores (1-10) for relevance and actionability are displayed.",
             "Structural metrics (service coverage, context richness) are charted."],
        ),
        (
            "US-06 — Select the LLM Backend",
            "As a developer without an Anthropic API key, I want to switch to a local "
            "Ollama model so that I can run the pipeline without cloud dependency.",
            ["A sidebar selector offers Anthropic and Ollama as backend options.",
             "The Ollama model name is freely configurable.",
             "Streaming behaviour is identical for both backends."],
        ),
        (
            "US-07 — Reset Services",
            "As a demo presenter, I want to reset all injected anomalies in one "
            "action so that I can repeat the demonstration from a clean state.",
            ["A Reset All Services control is available on the Anomaly Injection page.",
             "Services return to a healthy baseline within one Prometheus scrape cycle.",
             "A confirmation is displayed after reset."],
        ),
        (
            "US-08 — Inspect MCP Tool Calls",
            "As an AI developer, I want to see which MCP tools each agent invoked "
            "so that I can debug pipeline behaviour.",
            ["Tool call names and truncated results are shown per agent in the output.",
             "Tool calls are grouped under the agent that issued them.",
             "Raw tool output can be expanded."],
        ),
        (
            "US-09 — Access Grafana Dashboards",
            "As a DevOps engineer, I want direct access to Grafana so that I can "
            "inspect raw time-series data beyond the application view.",
            ["Grafana is accessible at the provisioned port with pre-configured credentials.",
             "Prometheus datasource and dashboards are auto-provisioned on first startup.",
             "No manual Grafana configuration is required."],
        ),
        (
            "US-10 — Run the Test Suite",
            "As a developer, I want to run the full test suite locally so that I can "
            "validate system correctness before committing changes.",
            ["Unit tests run without any external services or Docker dependency.",
             "Integration and end-to-end tests are clearly documented as requiring Docker Compose.",
             "The suite covers both Python backend logic and JavaScript frontend components."],
        ),
    ]

    for title_text, story_text, criteria in stories:
        block = (
            [p(title_text, S["h3"]),
             p(story_text, S["body"]),
             p("<b>Acceptance Criteria:</b>", S["h2"])]
            + [p(f"(i)  {c}", S["accept"]) for c in criteria]
            + [Spacer(1, 0.25 * cm)]
        )
        elems.append(KeepTogether(block))

    # ── 7. Use Cases ──────────────────────────────────────────────────────────
    elems += [PageBreak(), p("7. Use Cases", S["h1"]), hr()]

    use_cases = [
        (
            "UC-01 — Cascade Failure Detection and Diagnosis",
            "DevOps engineer",
            "The engineer triggers the cascade failure injection preset. Redis cache "
            "degrades, causing payment-service and order-service to exceed their "
            "latency thresholds. After one Prometheus scrape cycle the engineer "
            "initiates the pipeline.",
            [
                "The Monitor Agent detects redis_cache_hit_ratio below the 50% threshold.",
                "The Analyst traverses DEPENDS_ON edges, establishing that redis-cache "
                "is upstream of payment-service, which is upstream of order-service.",
                "The Analyst retrieves the Redis runbook and a similar historical incident.",
                "The Responder generates a step-by-step restart plan with explicit "
                "runbook identifiers for each affected service.",
            ],
            "A structured remediation plan is displayed, identifying redis-cache "
            "as the root cause and listing all affected downstream services.",
        ),
        (
            "UC-02 — Single-Service Latency Anomaly",
            "Site reliability engineer",
            "The engineer injects high latency on api-gateway only.",
            [
                "The Monitor Agent detects api_gateway_request_duration_p95 "
                "exceeding the 400 ms threshold.",
                "The Analyst determines that api-gateway has no downstream dependants "
                "in the topology graph.",
                "The Responder retrieves and cites the api-gateway runbook only.",
            ],
            "A scoped remediation plan is produced for api-gateway, with no "
            "references to unaffected services.",
        ),
        (
            "UC-03 — GraphRAG Evaluation Run",
            "Researcher",
            "The researcher runs all benchmark queries via the GraphRAG Evaluation "
            "page using the Anthropic judge.",
            [
                "Ten queries are executed against both GraphRAG and Naive RAG.",
                "The LLM-as-judge scores content relevance and actionability (1-10) "
                "for each result.",
                "Service coverage and context richness are computed from graph metadata.",
                "A bar chart renders the comparison across all metrics.",
            ],
            "A side-by-side table shows GraphRAG achieving service_coverage = 1.0 "
            "versus Naive RAG at 0.0 on topology-dependent queries.",
        ),
        (
            "UC-04 — Offline Pipeline with Local LLM",
            "Developer (offline environment)",
            "The developer selects Ollama with a 14B-parameter model in the UI "
            "sidebar and runs the pipeline.",
            [
                "The pipeline routes all LLM calls to the local Ollama instance.",
                "All three agents complete their bounded tool-call rounds.",
                "Output is streamed via SSE to the frontend.",
            ],
            "Full pipeline output is produced with the same structural format "
            "as an Anthropic-backed run, without requiring network access.",
        ),
        (
            "UC-05 — Blast Radius Query on Dependency Graph",
            "Platform engineer",
            "The engineer opens the Dependency Graph page and selects redis-cache.",
            [
                "The Neo4j MCP get_blast_radius tool is called with redis-cache.",
                "The graph highlights payment-service and order-service as impacted nodes.",
                "Affected nodes are rendered in a distinct warning colour.",
            ],
            "An interactive graph with blast-radius overlay correctly identifies "
            "both downstream services.",
        ),
    ]

    for uc_title, actor, desc, steps, output in use_cases:
        block = [p(uc_title, S["h3"])]
        block.append(_uc_table([["Actor", actor], ["Description", desc]]))
        block.append(p("<b>Steps:</b>", S["h2"]))
        for i, step in enumerate(steps, 1):
            block.append(p(f"{i}. {step}", S["body"]))
        block.append(p(f"<b>Expected output:</b>  {output}", S["body"]))
        block.append(Spacer(1, 0.2 * cm))
        elems.append(KeepTogether(block))

    # ── 8. Evaluation Scenarios ───────────────────────────────────────────────
    elems += [
        p("8. Evaluation Scenarios", S["h1"]), hr(),
        p(
            "The system will be validated through the following evaluation scenarios. "
            "Each scenario defines an input condition, the expected system behaviour, "
            "and a measurable success criterion.",
            S["body"],
        ),
    ]

    elems.append(_table(
        [
            ["#", "Scenario", "Input", "Expected Behaviour", "Criterion"],
            ["ES-01", "Cascade detection",
             "Inject cascade failure; run pipeline",
             "Monitor produces a JSON anomaly list naming redis-cache, "
             "payment-service, and order-service at correct severity levels",
             "All three services present in the anomaly list"],
            ["ES-02", "Root-cause analysis",
             "Cascade active; Analyst runs",
             "Analyst identifies redis-cache as root cause via DEPENDS_ON traversal",
             "Root cause field equals redis-cache"],
            ["ES-03", "GraphRAG advantage",
             "Run evaluation on cascade blast-radius query",
             "GraphRAG service_coverage = 1.0; Naive RAG service_coverage = 0.0",
             "GraphRAG coverage strictly greater than Naive RAG on topology queries"],
            ["ES-04", "Judge consistency",
             "Run full evaluation twice consecutively",
             "Judge scores differ by no more than 2 points across runs",
             "Score standard deviation across runs is less than 2.0"],
            ["ES-05", "Ollama completion",
             "Run pipeline with local Ollama 14B+ model",
             "All three agents complete; Responder cites at least one runbook ID",
             "No tool-call hallucination; output matches Anthropic structural format"],
            ["ES-06", "Anomaly reset",
             "Inject cascade; reset; wait one scrape; run pipeline",
             "Monitor finds no anomalies after reset",
             "Monitor returns empty anomaly list or no-anomaly confirmation"],
            ["ES-07", "Unit test suite",
             "Run unit tests with no external services",
             "All unit tests pass",
             "Zero test failures reported"],
            ["ES-08", "Integration tests",
             "Run integration tests against live Docker Compose stack",
             "All integration tests pass",
             "Zero test failures reported"],
            ["ES-09", "Frontend build",
             "Run Next.js production build",
             "Build completes without TypeScript or lint errors",
             "Production artefacts produced with no errors"],
            ["ES-10", "Frontend tests",
             "Run frontend test suite (schema, utils, components)",
             "All frontend tests pass",
             "Zero test failures reported"],
        ],
        col_widths=_cw(0.10, 0.15, 0.19, 0.33, 0.23),
        nowrap_header=True,
    ))
    elems.append(Spacer(1, 0.3 * cm))

    # ── 9. Limitations ────────────────────────────────────────────────────────
    elems += [
        PageBreak(), p("9. Limitations", S["h1"]), hr(),
        p(
            "The following limitations are anticipated for the current design scope. "
            "Each is described with its cause and its expected impact on system behaviour.",
            S["body"],
        ),
    ]

    limits = [
        (
            "Simulated Metrics",
            "Microservices will emit synthetic Prometheus metrics rather than traffic "
            "from real production systems. Anomaly thresholds are tuned to the "
            "simulation and may require recalibration for real workloads.",
        ),
        (
            "Limited Knowledge Base Scale",
            "The Neo4j corpus is planned to contain 15 runbooks, 20 incident reports, "
            "and 5 service nodes. Real deployments would require a substantially "
            "larger, continuously updated corpus to maintain retrieval quality across "
            "diverse failure modes.",
        ),
        (
            "API Rate Limit Sensitivity",
            "The Anthropic API imposes a limit of 30,000 tokens per minute at the "
            "claude-haiku tier. Tool result truncation at 3,000 characters mitigates "
            "this but may discard relevant context in verbose responses.",
        ),
        (
            "Ollama Model Reliability",
            "Models below approximately 14B parameters tend to hallucinate tool "
            "inputs or ignore tool outputs in multi-step agentic settings. The "
            "Anthropic backend is recommended for reliable results.",
        ),
        (
            "Context Window Exhaustion",
            "Long pipeline runs with many tool-call rounds may approach the context "
            "window limit of the haiku model, potentially causing the model to "
            "truncate earlier context and degrade the quality of the final plan.",
        ),
        (
            "Static Topology",
            "The Neo4j service topology will be seeded once via a seed script. "
            "It will not update automatically to reflect infrastructure changes. "
            "Real adoption would require integration with live topology discovery "
            "such as a Kubernetes service mesh.",
        ),
    ]

    for lim_name, lim_desc in limits:
        elems.append(KeepTogether([
            p(f"<b>{lim_name}</b>", S["h3"]),
            p(lim_desc, S["body"]),
        ]))
    elems.append(Spacer(1, 0.3 * cm))

    # ── 10. Demo Plan ──────────────────────────────────────────────────────────
    elems += [
        PageBreak(), p("10. Demo Plan", S["h1"]), hr(),
        p(
            "The live demonstration will run end-to-end in approximately five to seven "
            "minutes using the Next.js Mission Control dashboard. All services will "
            "be started via a single <code>docker compose up</code> command.",
            S["body"],
        ),
        p("<b>10.1 Setup</b>", S["h2"]),
    ]

    elems.append(_table(
        [
            ["Step", "Action", "Purpose"],
            ["1", "Start all services via Docker Compose",
             "Bring up Prometheus, Grafana, Neo4j, simulated microservices, "
             "FastAPI backend, and the Next.js frontend"],
            ["2", "Initialise the Neo4j topology graph",
             "Seed service nodes and DEPENDS_ON edges (required on first run only)"],
            ["3", "Ingest runbooks and incidents into Neo4j",
             "Compute embeddings and populate the GraphRAG knowledge base "
             "(required on first run only)"],
            ["4", "Open the dashboard",
             "Verify that all service connectivity checks pass on the Home page"],
        ],
        col_widths=_cw(0.08, 0.31, 0.61),
        nowrap_header=True,
    ))
    elems.append(Spacer(1, 0.3 * cm))

    elems += [p("<b>10.2 Demonstration Sequence</b>", S["h2"])]

    demo_steps = [
        (
            "Step 1 — Service Health Overview",
            "Navigate to the Dashboard page. Display real-time P95 latency charts "
            "for all five services and point out the healthy baseline values and "
            "the anomaly threshold for each.",
        ),
        (
            "Step 2 — Inject Cascade Failure",
            "Navigate to the Anomaly Injection page. Trigger the cascade failure "
            "preset. Explain that Redis cache failure propagates to payment-service "
            "and order-service via the DEPENDS_ON relationships in the topology graph.",
        ),
        (
            "Step 3 — Wait for Prometheus",
            "Wait approximately 60 seconds for Prometheus to scrape new metric values. "
            "Optionally display the Prometheus expression browser at localhost:9090 "
            "to show the raw metric changes in real time.",
        ),
        (
            "Step 4 — Execute the Agent Pipeline",
            "Navigate to the Agent Pipeline page. Select the Anthropic backend in "
            "the sidebar. Click Run. Show Monitor, Analyst, and Responder agent output "
            "streaming sequentially, with tool call progress visible per agent node.",
        ),
        (
            "Step 5 — Review Key Outputs",
            "Highlight the Monitor Agent's JSON anomaly list, the Analyst Agent's "
            "root-cause conclusion (redis-cache), and the Responder Agent's "
            "runbook-referenced remediation plan with action steps for each service.",
        ),
        (
            "Step 6 — Service Dependency Graph",
            "Navigate to the Topology page. Display the interactive force-directed "
            "graph. Select redis-cache and show the blast-radius overlay highlighting "
            "payment-service and order-service.",
        ),
        (
            "Step 7 — GraphRAG Evaluation",
            "Navigate to the GraphRAG Evaluation page. Run all benchmark queries "
            "with the Anthropic judge. Present the service coverage metric — "
            "GraphRAG is expected to score 1.0 versus Naive RAG at 0.0 on "
            "topology-dependent cascade queries — and explain the structural reason.",
        ),
        (
            "Step 8 — Reset",
            "Return to the Anomaly Injection page. Trigger Reset All Services. "
            "Confirm that all services return to their healthy baseline within "
            "one Prometheus scrape cycle.",
        ),
    ]

    for step_title, step_desc in demo_steps:
        elems.append(KeepTogether([
            p(step_title, S["h3"]),
            p(step_desc, S["body"]),
        ]))

    elems += [
        Spacer(1, 0.3 * cm),
        hr(),
        p(
            "The demonstration will illustrate the three core technical contributions "
            "of the project:",
            S["body"],
        ),
        b(
            "<b>MCP</b> as a structured, domain-specific tool abstraction layer "
            "between the agent pipeline and infrastructure APIs.",
            S["bullet"],
        ),
        b(
            "<b>LangGraph</b> multi-agent orchestration providing specialised, "
            "observable reasoning across a three-agent pipeline.",
            S["bullet"],
        ),
        b(
            "<b>GraphRAG</b> demonstrating measurable superiority over naive vector "
            "retrieval on topology-dependent infrastructure incident queries.",
            S["bullet"],
        ),
        Spacer(1, 0.6 * cm),
        hr(),
    ]

    return elems


# ── Entry point ────────────────────────────────────────────────────────────────

def main():
    import os
    out = os.path.join(os.path.dirname(__file__), "InfraWatch_PDD.pdf")
    S = _styles()
    doc = _make_doc(out)
    doc.build(build_content(S))
    print(f"Generated: {out}")


if __name__ == "__main__":
    main()
