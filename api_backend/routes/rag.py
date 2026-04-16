"""GraphRAG vs Naive RAG evaluation endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from graph.retrieval import graphrag_retrieve, naive_rag_retrieve

router = APIRouter()


class EvalRequest(BaseModel):
    query: str
    service_context: str | None = None
    top_k: int = 5
    judge_provider: str = "anthropic"
    judge_model: str | None = None
    judge_api_key: str | None = Field(None, repr=False)


@router.post("/evaluate")
async def evaluate_rag(req: EvalRequest):
    graphrag_results = await graphrag_retrieve(
        query=req.query,
        service_context=req.service_context,
        top_k=req.top_k,
    )
    naive_results = await naive_rag_retrieve(
        query=req.query,
        top_k=req.top_k,
    )
    return {
        "query": req.query,
        "judge_provider": req.judge_provider,
        "judge_model": req.judge_model,
        "graphrag": graphrag_results,
        "naive": naive_results,
    }
