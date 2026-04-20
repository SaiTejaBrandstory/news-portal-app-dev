import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.subscriber_preferences import Subscriber_preferencesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/subscriber_preferences", tags=["subscriber_preferences"])


# ---------- Pydantic Schemas ----------
class Subscriber_preferencesData(BaseModel):
    """Entity data schema (for create/update)"""
    subscriber_id: int
    category_name: str = None
    newsletter_frequency: str = None
    template_preference: str = None
    content_format: str = None
    is_active: bool = None
    created_at: Optional[datetime] = None


class Subscriber_preferencesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    subscriber_id: Optional[int] = None
    category_name: Optional[str] = None
    newsletter_frequency: Optional[str] = None
    template_preference: Optional[str] = None
    content_format: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None


class Subscriber_preferencesResponse(BaseModel):
    """Entity response schema"""
    id: int
    subscriber_id: int
    category_name: Optional[str] = None
    newsletter_frequency: Optional[str] = None
    template_preference: Optional[str] = None
    content_format: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Subscriber_preferencesListResponse(BaseModel):
    """List response schema"""
    items: List[Subscriber_preferencesResponse]
    total: int
    skip: int
    limit: int


class Subscriber_preferencesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Subscriber_preferencesData]


class Subscriber_preferencesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Subscriber_preferencesUpdateData


class Subscriber_preferencesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Subscriber_preferencesBatchUpdateItem]


class Subscriber_preferencesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Subscriber_preferencesListResponse)
async def query_subscriber_preferencess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query subscriber_preferencess with filtering, sorting, and pagination"""
    logger.debug(f"Querying subscriber_preferencess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Subscriber_preferencesService(db)
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
        logger.debug(f"Found {result['total']} subscriber_preferencess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying subscriber_preferencess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Subscriber_preferencesListResponse)
async def query_subscriber_preferencess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query subscriber_preferencess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying subscriber_preferencess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Subscriber_preferencesService(db)
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
        logger.debug(f"Found {result['total']} subscriber_preferencess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying subscriber_preferencess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Subscriber_preferencesResponse)
async def get_subscriber_preferences(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single subscriber_preferences by ID"""
    logger.debug(f"Fetching subscriber_preferences with id: {id}, fields={fields}")
    
    service = Subscriber_preferencesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Subscriber_preferences with id {id} not found")
            raise HTTPException(status_code=404, detail="Subscriber_preferences not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching subscriber_preferences {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Subscriber_preferencesResponse, status_code=201)
async def create_subscriber_preferences(
    data: Subscriber_preferencesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new subscriber_preferences"""
    logger.debug(f"Creating new subscriber_preferences with data: {data}")
    
    service = Subscriber_preferencesService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create subscriber_preferences")
        
        logger.info(f"Subscriber_preferences created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating subscriber_preferences: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating subscriber_preferences: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Subscriber_preferencesResponse], status_code=201)
async def create_subscriber_preferencess_batch(
    request: Subscriber_preferencesBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple subscriber_preferencess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} subscriber_preferencess")
    
    service = Subscriber_preferencesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} subscriber_preferencess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Subscriber_preferencesResponse])
async def update_subscriber_preferencess_batch(
    request: Subscriber_preferencesBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple subscriber_preferencess in a single request"""
    logger.debug(f"Batch updating {len(request.items)} subscriber_preferencess")
    
    service = Subscriber_preferencesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} subscriber_preferencess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Subscriber_preferencesResponse)
async def update_subscriber_preferences(
    id: int,
    data: Subscriber_preferencesUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing subscriber_preferences"""
    logger.debug(f"Updating subscriber_preferences {id} with data: {data}")

    service = Subscriber_preferencesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Subscriber_preferences with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Subscriber_preferences not found")
        
        logger.info(f"Subscriber_preferences {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating subscriber_preferences {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating subscriber_preferences {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_subscriber_preferencess_batch(
    request: Subscriber_preferencesBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple subscriber_preferencess by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} subscriber_preferencess")
    
    service = Subscriber_preferencesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} subscriber_preferencess successfully")
        return {"message": f"Successfully deleted {deleted_count} subscriber_preferencess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_subscriber_preferences(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single subscriber_preferences by ID"""
    logger.debug(f"Deleting subscriber_preferences with id: {id}")
    
    service = Subscriber_preferencesService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Subscriber_preferences with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Subscriber_preferences not found")
        
        logger.info(f"Subscriber_preferences {id} deleted successfully")
        return {"message": "Subscriber_preferences deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting subscriber_preferences {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")