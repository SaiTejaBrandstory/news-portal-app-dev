import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.newsletter_engine import NewsletterEngineService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/newsletter", tags=["newsletter-engine"])


# ---------- Schemas ----------
class SubscribeRequest(BaseModel):
    email: str
    first_name: str = ""
    last_name: str = ""


class ComposeRequest(BaseModel):
    subject: str
    template_key: str
    article_ids: List[int]
    scheduled_date: str
    newsletter_type: str = "manual"


class ProcessQueueRequest(BaseModel):
    batch_size: int = 50


class ABTestRequest(BaseModel):
    subject_a: str
    subject_b: str
    template_key_a: str
    template_key_b: str
    article_ids: List[int]
    scheduled_date: str
    test_percentage: int = 20


class BulkImportItem(BaseModel):
    email: str
    first_name: str = ""
    last_name: str = ""
    timezone: str = "America/New_York"


class BulkImportRequest(BaseModel):
    subscribers: List[BulkImportItem]


class SubscriberUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: Optional[str] = None
    email_verified: Optional[bool] = None
    timezone: Optional[str] = None
    preferred_send_time: Optional[str] = None


# ---------- Public Endpoints ----------
@router.post("/subscribe")
async def subscribe(
    data: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public subscribe endpoint - no auth required."""
    try:
        service = NewsletterEngineService(db)
        result = await service.subscribe(data.email, data.first_name, data.last_name)
        return result
    except Exception as e:
        logger.error(f"Subscribe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Admin Endpoints ----------
@router.get("/dashboard")
async def get_dashboard(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get newsletter dashboard stats."""
    service = NewsletterEngineService(db)
    return await service.get_dashboard_stats()


@router.get("/recent-campaigns")
async def get_recent_campaigns(
    limit: int = Query(10, ge=1, le=50),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent newsletter campaigns."""
    service = NewsletterEngineService(db)
    return await service.get_recent_campaigns(limit)


@router.get("/published-articles")
async def get_published_articles(
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get published articles for newsletter composition."""
    service = NewsletterEngineService(db)
    return await service.get_published_articles(limit)


@router.post("/compose")
async def compose_newsletter(
    data: ComposeRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compose and queue a newsletter."""
    try:
        service = NewsletterEngineService(db)
        result = await service.compose_and_queue(
            subject=data.subject,
            template_key=data.template_key,
            article_ids=data.article_ids,
            scheduled_date=data.scheduled_date,
            newsletter_type=data.newsletter_type,
        )
        return result
    except Exception as e:
        logger.error(f"Compose error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process-queue")
async def process_queue(
    data: ProcessQueueRequest = ProcessQueueRequest(),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process pending queue items (mock send)."""
    try:
        service = NewsletterEngineService(db)
        result = await service.process_queue(data.batch_size)
        return result
    except Exception as e:
        logger.error(f"Process queue error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ab-test")
async def create_ab_test(
    data: ABTestRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an A/B test."""
    try:
        service = NewsletterEngineService(db)
        result = await service.create_ab_test(
            subject_a=data.subject_a,
            subject_b=data.subject_b,
            template_key_a=data.template_key_a,
            template_key_b=data.template_key_b,
            article_ids=data.article_ids,
            scheduled_date=data.scheduled_date,
            test_percentage=data.test_percentage,
        )
        return result
    except Exception as e:
        logger.error(f"A/B test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ab-tests")
async def get_ab_tests(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of all A/B tests."""
    service = NewsletterEngineService(db)
    return await service.get_ab_tests_list()


@router.get("/ab-test/{ab_test_id}")
async def get_ab_test_results(
    ab_test_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get A/B test results."""
    service = NewsletterEngineService(db)
    return await service.get_ab_test_results(ab_test_id)


@router.post("/bulk-import")
async def bulk_import(
    data: BulkImportRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import subscribers."""
    try:
        service = NewsletterEngineService(db)
        rows = [item.model_dump() for item in data.subscribers]
        result = await service.bulk_import_subscribers(rows)
        return result
    except Exception as e:
        logger.error(f"Bulk import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export-subscribers")
async def export_subscribers(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all subscribers."""
    service = NewsletterEngineService(db)
    return await service.export_subscribers()