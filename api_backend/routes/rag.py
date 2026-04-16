"""GraphRAG vs Naive RAG evaluation endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from graph.evaluation import build_mode_metrics, content_overlap, judge_result_sets
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
    graphrag_judge, naive_judge, _, _ = await judge_result_sets(
        req.query,
        graphrag_results,
        naive_results,
        provider=req.judge_provider,
        model=req.judge_model,
        api_key=req.judge_api_key,
    )

    graphrag_metrics = build_mode_metrics(graphrag_results)
    naive_metrics = build_mode_metrics(naive_results)
    graphrag_metrics["llm_content_relevance"] = graphrag_judge["content_relevance"]
    graphrag_metrics["llm_actionability"] = graphrag_judge["actionability"]
    naive_metrics["llm_content_relevance"] = naive_judge["content_relevance"]
    naive_metrics["llm_actionability"] = naive_judge["actionability"]

    return {
        "query": req.query,
        "judge_provider": req.judge_provider,
        "judge_model": req.judge_model,
        "content_overlap": round(content_overlap(graphrag_results, naive_results), 2),
        "graphrag": {
            **graphrag_results,
            "metrics": graphrag_metrics,
        },
        "naive": {
            **naive_results,
            "metrics": naive_metrics,
        },
    }
