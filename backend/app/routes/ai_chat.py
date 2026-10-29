from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.orm_models import User, AIConversation
from app.routes.auth import get_current_user
from app.services.ai_service import ai_service

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    model: str = "nebius"


class TaskAnalysisRequest(BaseModel):
    task_title: str
    task_description: Optional[str] = None


class NoteSummaryRequest(BaseModel):
    note_content: str
    summary_length: str = "medium"


class GoalPlanRequest(BaseModel):
    goal_title: str
    goal_description: Optional[str] = None


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        result = await ai_service.chat(
            message=request.message,
            model=request.model,
            system_prompt="You are a helpful productivity assistant."
        )
        
        conversation = AIConversation(
            user_id=current_user.id,
            model=result.get("model", request.model),
            user_message=request.message,
            ai_response=result["response"],
            total_tokens=result.get("tokens_used") or 0
        )
        db.add(conversation)
        db.commit()
        
        return {
            "response": result["response"],
            "model": result["model"],
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/conversations")
async def get_conversations(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conversations = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).order_by(AIConversation.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": str(conv.id),
            "model": conv.model,
            "user_message": conv.user_message,
            "ai_response": conv.ai_response,
            "created_at": conv.created_at
        }
        for conv in conversations
    ]


@router.delete("/conversations")
async def clear_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).delete()
    db.commit()
    return {"message": "Conversations cleared"}


@router.post("/analyze-task")
async def analyze_task(
    request: TaskAnalysisRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        analysis = await ai_service.analyze_task(
            task_title=request.task_title,
            task_description=request.task_description
        )
        return {"analysis": analysis, "timestamp": datetime.utcnow()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/summarize-note")
async def summarize_note(
    request: NoteSummaryRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        summary = await ai_service.summarize_note(
            content=request.note_content,
            length=request.summary_length
        )
        return {"summary": summary, "timestamp": datetime.utcnow()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@router.post("/generate-goal-plan")
async def generate_goal_plan(
    request: GoalPlanRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        plan = await ai_service.generate_goal_plan(
            goal_title=request.goal_title,
            goal_description=request.goal_description
        )
        return {"plan": plan, "timestamp": datetime.utcnow()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {str(e)}")


@router.post("/brainstorm")
async def brainstorm(
    topic: str,
    num_ideas: int = 10,
    current_user: User = Depends(get_current_user)
):
    try:
        prompt = f"Generate {num_ideas} creative ideas about: {topic}"
        result = await ai_service.chat(
            message=prompt,
            model="gemini",
            system_prompt="You are a creative brainstorming assistant."
        )
        return {"ideas": result["response"], "topic": topic}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brainstorm failed: {str(e)}")


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).count()
    
    return {
        "total_conversations": total,
        "timestamp": datetime.utcnow()
    }
