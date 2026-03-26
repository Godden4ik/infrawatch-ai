"""InfraWatch API Backend — control plane for the monitoring system."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_backend.routes import health, pipeline, graph, anomaly, rag, models


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="InfraWatch API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
app.include_router(graph.router, prefix="/graph", tags=["graph"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["anomaly"])
app.include_router(rag.router, prefix="/rag", tags=["rag"])
app.include_router(models.router, prefix="/models", tags=["models"])
