import logging
import os
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from schemas.news import (
    FetchAndRewriteRequest,
    FetchAndRewriteResult,
    TogglePublishRequest,
    TogglePublishResponse,
    SettingsUpdateRequest,
    SettingsResponse,
    ScrapeRequest,
    ScrapeResult,
    ScrapedArticlePreview,
    ScrapeApproveRequest,
    ManualSubmitRequest,
    ManualSubmitResponse,
    SearchRequest,
    SearchResult,
    SearchResultItem,
)
from services.news_service import NewsService
from services.articles import ArticlesService
from services.publication_settings import Publication_settingsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/news", tags=["news"])


@router.post("/fetch-and-rewrite", response_model=FetchAndRewriteResult)
async def fetch_and_rewrite(
    data: FetchAndRewriteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch news from Apify Google News Scraper, rewrite with AI, and store in database."""
    try:
        service = NewsService(db)
        results = await service.fetch_and_rewrite(
            category=data.category,
            max_articles=data.max_articles,
            auto_publish=data.auto_publish,
            rewrite_style=data.rewrite_style,
        )
        return FetchAndRewriteResult(
            articles=results,
            total_fetched=len(results),
            message=f"Successfully fetched and rewrote {len(results)} articles",
        )
    except Exception as e:
        logger.error(f"Error in fetch-and-rewrite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug-fetch")
async def debug_fetch(
    category: str = "general",
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Debug endpoint to test Apify news fetching without rewriting."""
    service = NewsService(db)
    token_present = bool(service.apify_token)
    token_preview = service.apify_token[:8] + "..." if service.apify_token else "NOT SET"

    try:
        raw_articles = await service.fetch_news(category, max_articles=3)
        return {
            "apify_token_present": token_present,
            "apify_token_preview": token_preview,
            "category": category,
            "articles_count": len(raw_articles),
            "articles": raw_articles,
        }
    except Exception as e:
        return {
            "apify_token_present": token_present,
            "apify_token_preview": token_preview,
            "category": category,
            "error": str(e),
        }


@router.post("/scrape", response_model=ScrapeResult)
async def scrape_urls(
    data: ScrapeRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scrape article content from provided URLs, rewrite with AI, and return previews."""
    if not data.urls:
        raise HTTPException(status_code=400, detail="Please provide at least one URL")

    try:
        service = NewsService(db)
        previews = await service.scrape_and_rewrite(
            urls=data.urls,
            category=data.category,
            rewrite_style=data.rewrite_style,
            words_length=data.words_length,
        )

        successful = [p for p in previews if not p.get("error")]
        errors = [p for p in previews if p.get("error")]

        return ScrapeResult(
            articles=[ScrapedArticlePreview(**p) for p in previews],
            total_scraped=len(successful),
            total_errors=len(errors),
            message=f"Scraped {len(successful)} articles, {len(errors)} errors",
        )
    except Exception as e:
        logger.error(f"Error in scrape: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scrape-approve", response_model=FetchAndRewriteResult)
async def scrape_approve(
    data: ScrapeApproveRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve and save scraped articles to the database."""
    try:
        service = NewsService(db)
        articles_data = [art.model_dump() for art in data.articles]
        results = await service.save_scraped_articles(
            articles=articles_data,
            category=data.category,
            auto_publish=data.auto_publish,
        )
        return FetchAndRewriteResult(
            articles=results,
            total_fetched=len(results),
            message=f"Saved {len(results)} articles to database",
        )
    except Exception as e:
        logger.error(f"Error in scrape-approve: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manual-submit", response_model=ManualSubmitResponse)
async def manual_submit(
    data: ManualSubmitRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually submit a new article."""
    if not data.title or not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if not data.content or not data.content.strip():
        raise HTTPException(status_code=400, detail="Content is required")

    try:
        service = NewsService(db)
        result = await service.manual_create_article(
            title=data.title.strip(),
            summary=(data.summary or "").strip() or None,
            content=data.content.strip(),
            category=data.category,
            source_url=(data.source_url or "").strip() or None,
            author=(data.author or "").strip() or None,
            image_url=data.image_url,
            tags=(data.tags or "").strip() or None,
            published_at_str=(data.published_at or "").strip() or None,
            is_published=data.is_published,
        )
        return ManualSubmitResponse(
            id=result["id"],
            title=result["title"],
            slug=result["slug"],
            category=result["category"],
            is_published=result["is_published"],
            message="Article created successfully",
        )
    except Exception as e:
        logger.error(f"Error in manual-submit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/toggle-publish", response_model=TogglePublishResponse)
async def toggle_publish(
    data: TogglePublishRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the publish status of an article."""
    try:
        service = ArticlesService(db)
        now = datetime.now()
        update_data = {
            "is_published": data.is_published,
            "published_at": now if data.is_published else None,
        }
        article = await service.update(data.article_id, update_data)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")

        return TogglePublishResponse(
            id=article.id,
            is_published=article.is_published,
            published_at=str(article.published_at) if article.published_at else None,
            message=f"Article {'published' if data.is_published else 'unpublished'} successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling publish: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings", response_model=List[SettingsResponse])
async def get_settings(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all publication settings."""
    try:
        service = Publication_settingsService(db)
        result = await service.get_list(limit=50)
        return [
            SettingsResponse(
                id=item.id,
                setting_key=item.setting_key,
                setting_value=item.setting_value,
                description=item.description,
            )
            for item in result["items"]
        ]
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=SearchResult)
async def search_articles(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Search published articles across title, content, summary, tags, category."""
    if not data.query or not data.query.strip():
        return SearchResult(articles=[], total=0, query="", message="Empty search query")

    try:
        service = NewsService(db)
        results = await service.search_articles(
            query=data.query.strip(),
            limit=data.limit,
        )
        return SearchResult(
            articles=[SearchResultItem(**r) for r in results],
            total=len(results),
            query=data.query.strip(),
            message=f"Found {len(results)} result{'s' if len(results) != 1 else ''} for '{data.query.strip()}'",
        )
    except Exception as e:
        logger.error(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings", response_model=SettingsResponse)
async def update_setting(
    data: SettingsUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a publication setting."""
    try:
        service = Publication_settingsService(db)
        setting = await service.get_by_field("setting_key", data.setting_key)
        if not setting:
            raise HTTPException(status_code=404, detail=f"Setting '{data.setting_key}' not found")

        updated = await service.update(setting.id, {
            "setting_value": data.setting_value,
            "updated_at": datetime.now(),
        })
        return SettingsResponse(
            id=updated.id,
            setting_key=updated.setting_key,
            setting_value=updated.setting_value,
            description=updated.description,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating setting: {e}")
        raise HTTPException(status_code=500, detail=str(e))