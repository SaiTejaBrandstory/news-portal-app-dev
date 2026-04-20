import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.subscribers import SubscribersService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/subscribers", tags=["subscribers"])


# ---------- Pydantic Schemas ----------
class SubscribersData(BaseModel):
    """Entity data schema (for create/update)"""
    email: str
    first_name: str = None
    last_name: str = None
    status: str = None
    email_verified: bool = None
    verification_token: str = None
    timezone: str = None
    preferred_send_time: str = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SubscribersUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: Optional[str] = None
    email_verified: Optional[bool] = None
    verification_token: Optional[str] = None
    timezone: Optional[str] = None
    preferred_send_time: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SubscribersResponse(BaseModel):
    """Entity response schema"""
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: Optional[str] = None
    email_verified: Optional[bool] = None
    verification_token: Optional[str] = None
    timezone: Optional[str] = None
    preferred_send_time: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscribersListResponse(BaseModel):
    """List response schema"""
    items: List[SubscribersResponse]
    total: int
    skip: int
    limit: int


class SubscribersBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[SubscribersData]


class SubscribersBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: SubscribersUpdateData


class SubscribersBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[SubscribersBatchUpdateItem]


class SubscribersBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=SubscribersListResponse)
async def query_subscriberss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query subscriberss with filtering, sorting, and pagination"""
    logger.debug(f"Querying subscriberss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = SubscribersService(db)
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
        logger.debug(f"Found {result['total']} subscriberss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying subscriberss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=SubscribersListResponse)
async def query_subscriberss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query subscriberss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying subscriberss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = SubscribersService(db)
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
        logger.debug(f"Found {result['total']} subscriberss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying subscriberss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=SubscribersResponse)
async def get_subscribers(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single subscribers by ID"""
    logger.debug(f"Fetching subscribers with id: {id}, fields={fields}")
    
    service = SubscribersService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Subscribers with id {id} not found")
            raise HTTPException(status_code=404, detail="Subscribers not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching subscribers {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=SubscribersResponse, status_code=201)
async def create_subscribers(
    data: SubscribersData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new subscribers"""
    logger.debug(f"Creating new subscribers with data: {data}")
    
    service = SubscribersService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create subscribers")
        
        logger.info(f"Subscribers created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating subscribers: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating subscribers: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[SubscribersResponse], status_code=201)
async def create_subscriberss_batch(
    request: SubscribersBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple subscriberss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} subscriberss")
    
    service = SubscribersService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} subscriberss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[SubscribersResponse])
async def update_subscriberss_batch(
    request: SubscribersBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple subscriberss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} subscriberss")
    
    service = SubscribersService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} subscriberss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=SubscribersResponse)
async def update_subscribers(
    id: int,
    data: SubscribersUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing subscribers"""
    logger.debug(f"Updating subscribers {id} with data: {data}")

    service = SubscribersService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Subscribers with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Subscribers not found")
        
        logger.info(f"Subscribers {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating subscribers {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating subscribers {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_subscriberss_batch(
    request: SubscribersBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple subscriberss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} subscriberss")
    
    service = SubscribersService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} subscriberss successfully")
        return {"message": f"Successfully deleted {deleted_count} subscriberss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_subscribers(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single subscribers by ID"""
    logger.debug(f"Deleting subscribers with id: {id}")
    
    service = SubscribersService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Subscribers with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Subscribers not found")
        
        logger.info(f"Subscribers {id} deleted successfully")
        return {"message": "Subscribers deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting subscribers {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")