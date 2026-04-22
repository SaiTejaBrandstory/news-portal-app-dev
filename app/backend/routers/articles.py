import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.articles import ArticlesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/articles", tags=["articles"])


# ---------- Pydantic Schemas ----------
class ArticlesData(BaseModel):
    """Entity data schema (for create/update)"""
    title: str
    original_title: str = None
    content: str
    original_content: str = None
    summary: str = None
    category: str
    author: Optional[str] = None
    min_read: Optional[int] = None
    source_name: str = None
    source_url: str = None
    image_url: str = None
    slug: str
    tags: str = None
    is_published: bool = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ArticlesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    title: Optional[str] = None
    original_title: Optional[str] = None
    content: Optional[str] = None
    original_content: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    min_read: Optional[int] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    slug: Optional[str] = None
    tags: Optional[str] = None
    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ArticlesResponse(BaseModel):
    """Entity response schema"""
    id: int
    title: str
    original_title: Optional[str] = None
    content: str
    original_content: Optional[str] = None
    summary: Optional[str] = None
    category: str
    author: Optional[str] = None
    min_read: Optional[int] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    slug: str
    tags: Optional[str] = None
    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ArticlesListResponse(BaseModel):
    """List response schema"""
    items: List[ArticlesResponse]
    total: int
    skip: int
    limit: int


class ArticlesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[ArticlesData]


class ArticlesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: ArticlesUpdateData


class ArticlesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[ArticlesBatchUpdateItem]


class ArticlesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=ArticlesListResponse)
async def query_articless(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query articless with filtering, sorting, and pagination"""
    logger.debug(f"Querying articless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = ArticlesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} articless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying articless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=ArticlesListResponse)
async def query_articless_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query articless with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying articless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = ArticlesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} articless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying articless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=ArticlesResponse)
async def get_articles(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single articles by ID"""
    logger.debug(f"Fetching articles with id: {id}, fields={fields}")
    
    service = ArticlesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Articles with id {id} not found")
            raise HTTPException(status_code=404, detail="Articles not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching articles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=ArticlesResponse, status_code=201)
async def create_articles(
    data: ArticlesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new articles"""
    logger.debug(f"Creating new articles with data: {data}")
    
    service = ArticlesService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create articles")
        
        logger.info(f"Articles created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating articles: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating articles: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[ArticlesResponse], status_code=201)
async def create_articless_batch(
    request: ArticlesBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple articless in a single request"""
    logger.debug(f"Batch creating {len(request.items)} articless")
    
    service = ArticlesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} articless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[ArticlesResponse])
async def update_articless_batch(
    request: ArticlesBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple articless in a single request"""
    logger.debug(f"Batch updating {len(request.items)} articless")
    
    service = ArticlesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} articless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=ArticlesResponse)
async def update_articles(
    id: int,
    data: ArticlesUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing articles"""
    logger.debug(f"Updating articles {id} with data: {data}")

    service = ArticlesService(db)
    try:
        # Use only the fields that were explicitly sent in the request body.
        # model_fields_set contains the names of fields the client actually provided,
        # so we preserve intentional null values (e.g. clearing author) while still
        # ignoring fields that were simply omitted.
        update_dict = {k: v for k, v in data.model_dump().items() if k in data.model_fields_set}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Articles with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Articles not found")
        
        logger.info(f"Articles {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating articles {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating articles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_articless_batch(
    request: ArticlesBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple articless by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} articless")
    
    service = ArticlesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} articless successfully")
        return {"message": f"Successfully deleted {deleted_count} articless", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_articles(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single articles by ID"""
    logger.debug(f"Deleting articles with id: {id}")
    
    service = ArticlesService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Articles with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Articles not found")
        
        logger.info(f"Articles {id} deleted successfully")
        return {"message": "Articles deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting articles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")