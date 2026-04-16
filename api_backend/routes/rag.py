"""GraphRAG vs Naive RAG evaluation endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

from graph.retrieval import graphrag_retrieve, naive_rag_retrieve

router = APIRouter()

_KNOWN_SERVICES = [
    "api-gateway",
    "payment-service",
    "user-service",
    "order-service",
    "redis-cache",
]


def _infer_service_context(query: str) -> str | None:
    """Return the first known service name mentioned in the query, or None."""
    q = query.lower()
    for svc in _KNOWN_SERVICES:
        if svc in q:
            return svc
    return None


class EvalRequest(BaseModel):
    query: str
    service_context: str | None = None
    top_k: int = 5


@router.post("/evaluate")
async def evaluate_rag(req: EvalRequest):
    service_context = req.service_context or _infer_service_context(req.query)
    graphrag_results = await graphrag_retrieve(
        query=req.query,
        service_context=service_context,
        top_k=req.top_k,
    )
    naive_results = await naive_rag_retrieve(
        query=req.query,
        top_k=req.top_k,
    )
    return {
        "query": req.query,
        "graphrag": graphrag_results,
        "naive": naive_results,
    }
