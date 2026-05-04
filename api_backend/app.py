"""InfraWatch API Backend — control plane for the monitoring system."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_backend.routes import health, pipeline, graph, anomaly, rag, providers, metrics_stream, evaluation

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3001").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="InfraWatch API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
app.include_router(graph.router, prefix="/graph", tags=["graph"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["anomaly"])
app.include_router(rag.router, prefix="/rag", tags=["rag"])
app.include_router(providers.router, prefix="/providers", tags=["providers"])
app.include_router(metrics_stream.router, prefix="/metrics", tags=["metrics"])
app.include_router(evaluation.router, prefix="/evaluation", tags=["evaluation"])
