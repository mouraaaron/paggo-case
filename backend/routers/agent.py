from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ai_agent import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    confirmed_action: dict | None = None

class ChatResponse(BaseModel):
    reply: str
    pending_action: dict | None = None
    updated_history: list[dict]

@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        result = run_agent(req.history, req.message, req.confirmed_action)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
