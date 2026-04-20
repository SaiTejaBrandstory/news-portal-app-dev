import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.authors import AuthorsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/authors", tags=["authors"])


# ---------- Pydantic Schemas ----------
class AuthorsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    email: str
    bio: str = None
    photo_url: str = None
    role: str
    expertise_tags: str = None
    social_twitter: str = None
    social_linkedin: str = None
    social_website: str = None
    is_verified: bool = None
    contract_status: str = None
    payment_rate_type: str = None
    payment_rate_value: float = None
    total_articles: int = None
    total_published: int = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AuthorsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    role: Optional[str] = None
    expertise_tags: Optional[str] = None
    social_twitter: Optional[str] = None
    social_linkedin: Optional[str] = None
    social_website: Optional[str] = None
    is_verified: Optional[bool] = None
    contract_status: Optional[str] = None
    payment_rate_type: Optional[str] = None
    payment_rate_value: Optional[float] = None
    total_articles: Optional[int] = None
    total_published: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AuthorsResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    email: str
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    role: str
    expertise_tags: Optional[str] = None
    social_twitter: Optional[str] = None
    social_linkedin: Optional[str] = None
    social_website: Optional[str] = None
    is_verified: Optional[bool] = None
    contract_status: Optional[str] = None
    payment_rate_type: Optional[str] = None
    payment_rate_value: Optional[float] = None
    total_articles: Optional[int] = None
    total_published: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuthorsListResponse(BaseModel):
    """List response schema"""
    items: List[AuthorsResponse]
    total: int
    skip: int
    limit: int


class AuthorsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[AuthorsData]


class AuthorsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: AuthorsUpdateData


class AuthorsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[AuthorsBatchUpdateItem]


class AuthorsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=AuthorsListResponse)
async def query_authorss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query authorss with filtering, sorting, and pagination"""
    logger.debug(f"Querying authorss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = AuthorsService(db)
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
        logger.debug(f"Found {result['total']} authorss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying authorss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=AuthorsListResponse)
async def query_authorss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query authorss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying authorss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = AuthorsService(db)
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
        logger.debug(f"Found {result['total']} authorss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying authorss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=AuthorsResponse)
async def get_authors(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single authors by ID"""
    logger.debug(f"Fetching authors with id: {id}, fields={fields}")
    
    service = AuthorsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Authors with id {id} not found")
            raise HTTPException(status_code=404, detail="Authors not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching authors {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=AuthorsResponse, status_code=201)
async def create_authors(
    data: AuthorsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new authors"""
    logger.debug(f"Creating new authors with data: {data}")
    
    service = AuthorsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create authors")
        
        logger.info(f"Authors created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating authors: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating authors: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[AuthorsResponse], status_code=201)
async def create_authorss_batch(
    request: AuthorsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple authorss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} authorss")
    
    service = AuthorsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} authorss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[AuthorsResponse])
async def update_authorss_batch(
    request: AuthorsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple authorss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} authorss")
    
    service = AuthorsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} authorss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=AuthorsResponse)
async def update_authors(
    id: int,
    data: AuthorsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing authors"""
    logger.debug(f"Updating authors {id} with data: {data}")

    service = AuthorsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Authors with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Authors not found")
        
        logger.info(f"Authors {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating authors {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating authors {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_authorss_batch(
    request: AuthorsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple authorss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} authorss")
    
    service = AuthorsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} authorss successfully")
        return {"message": f"Successfully deleted {deleted_count} authorss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_authors(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single authors by ID"""
    logger.debug(f"Deleting authors with id: {id}")
    
    service = AuthorsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Authors with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Authors not found")
        
        logger.info(f"Authors {id} deleted successfully")
        return {"message": "Authors deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting authors {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")