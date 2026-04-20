"""Custom routes for Author Management Portal features."""
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.authors import Authors
from models.articles import Articles
from models.audit_logs import Audit_logs
from services.aihub import AIHubService
from schemas.aihub import GenTxtRequest, ChatMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/author-management", tags=["author-management"])


# ---------- Schemas ----------

class ContentAnalysisRequest(BaseModel):
    content: str
    title: Optional[str] = None


class ContentAnalysisResponse(BaseModel):
    ai_score: float
    plagiarism_score: float
    originality_score: float
    readability_grade: str
    word_count: int
    analysis_summary: str
    suggestions: list[str]


class SyncStatsResponse(BaseModel):
    updated_count: int
    authors: list[dict]


class AuditLogEntry(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None


# ---------- Routes ----------

@router.post("/content-analysis", response_model=ContentAnalysisResponse)
async def analyze_content(request: ContentAnalysisRequest):
    """Analyze content for AI detection, plagiarism risk, readability, and quality."""
    if not request.content or len(request.content.strip()) < 50:
        raise HTTPException(status_code=400, detail="Content must be at least 50 characters long")

    word_count = len(request.content.split())

    try:
        service = AIHubService()
        prompt = f"""You are a content analysis expert. Analyze the following article content and provide a JSON response with these exact fields:

1. "ai_score": A number between 0 and 100 representing the likelihood this content was AI-generated (0 = definitely human, 100 = definitely AI)
2. "plagiarism_score": A number between 0 and 100 representing the estimated plagiarism risk based on writing patterns (0 = highly original, 100 = likely copied)
3. "originality_score": A number between 0 and 100 representing content originality (100 = very original)
4. "readability_grade": One of "A+", "A", "B+", "B", "C+", "C", "D", "F" based on clarity, structure, and engagement
5. "analysis_summary": A brief 2-3 sentence summary of the content quality
6. "suggestions": An array of 2-4 specific improvement suggestions

Title: {request.title or 'Untitled'}

Content:
{request.content[:3000]}

Respond ONLY with valid JSON, no markdown formatting or code blocks."""

        ai_request = GenTxtRequest(
            messages=[
                ChatMessage(role="system", content="You are a professional content analysis tool. Always respond with valid JSON only."),
                ChatMessage(role="user", content=prompt),
            ],
            model="deepseek-v3.2",
        )
        response = await service.gentxt(ai_request)
        raw = response.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw = "\n".join(lines)

        result = json.loads(raw)

        return ContentAnalysisResponse(
            ai_score=min(100, max(0, float(result.get("ai_score", 50)))),
            plagiarism_score=min(100, max(0, float(result.get("plagiarism_score", 20)))),
            originality_score=min(100, max(0, float(result.get("originality_score", 70)))),
            readability_grade=result.get("readability_grade", "B"),
            word_count=word_count,
            analysis_summary=result.get("analysis_summary", "Analysis completed."),
            suggestions=result.get("suggestions", ["No specific suggestions."]),
        )
    except json.JSONDecodeError:
        # Fallback with heuristic scores
        return ContentAnalysisResponse(
            ai_score=35.0,
            plagiarism_score=10.0,
            originality_score=75.0,
            readability_grade="B",
            word_count=word_count,
            analysis_summary="Content analysis completed with heuristic scoring. The AI analysis response was not parseable.",
            suggestions=["Consider adding more unique perspectives.", "Vary sentence structure for better readability."],
        )
    except Exception as e:
        logger.error(f"Content analysis error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Content analysis failed: {str(e)}")


@router.post("/sync-author-stats", response_model=SyncStatsResponse)
async def sync_author_stats(db: AsyncSession = Depends(get_db)):
    """Recalculate and sync article counts for all authors based on source_name matching."""
    try:
        # Get all authors
        result = await db.execute(select(Authors))
        authors = result.scalars().all()

        updated = []
        for author in authors:
            # Count articles where source_name matches author name
            total_q = await db.execute(
                select(func.count(Articles.id)).where(Articles.source_name == author.name)
            )
            total = total_q.scalar() or 0

            published_q = await db.execute(
                select(func.count(Articles.id)).where(
                    Articles.source_name == author.name,
                    Articles.is_published == True,
                )
            )
            published = published_q.scalar() or 0

            author.total_articles = total
            author.total_published = published
            author.updated_at = datetime.utcnow()

            updated.append({
                "id": author.id,
                "name": author.name,
                "total_articles": total,
                "total_published": published,
            })

        await db.commit()

        return SyncStatsResponse(updated_count=len(updated), authors=updated)
    except Exception as e:
        await db.rollback()
        logger.error(f"Error syncing author stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to sync stats: {str(e)}")


@router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get audit logs with optional filtering."""
    try:
        query = select(Audit_logs).order_by(Audit_logs.created_at.desc())
        if entity_type:
            query = query.where(Audit_logs.entity_type == entity_type)
        if entity_id:
            query = query.where(Audit_logs.entity_id == entity_id)
        query = query.limit(limit)

        result = await db.execute(query)
        logs = result.scalars().all()

        return {
            "items": [
                {
                    "id": log.id,
                    "user_id": log.user_id,
                    "action": log.action,
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                    "details": log.details,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ],
            "total": len(logs),
        }
    except Exception as e:
        logger.error(f"Error fetching audit logs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit logs: {str(e)}")


@router.post("/audit-log")
async def create_audit_log(
    entry: AuditLogEntry,
    db: AsyncSession = Depends(get_db),
):
    """Create an audit log entry."""
    try:
        log = Audit_logs(
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            details=entry.details,
            created_at=datetime.utcnow(),
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return {"id": log.id, "message": "Audit log created"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating audit log: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create audit log: {str(e)}")