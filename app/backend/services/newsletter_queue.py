import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.newsletter_queue import Newsletter_queue

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Newsletter_queueService:
    """Service layer for Newsletter_queue operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Newsletter_queue]:
        """Create a new newsletter_queue"""
        try:
            obj = Newsletter_queue(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created newsletter_queue with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating newsletter_queue: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Newsletter_queue]:
        """Get newsletter_queue by ID"""
        try:
            query = select(Newsletter_queue).where(Newsletter_queue.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching newsletter_queue {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of newsletter_queues"""
        try:
            query = select(Newsletter_queue)
            count_query = select(func.count(Newsletter_queue.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Newsletter_queue, field):
                        query = query.where(getattr(Newsletter_queue, field) == value)
                        count_query = count_query.where(getattr(Newsletter_queue, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Newsletter_queue, field_name):
                        query = query.order_by(getattr(Newsletter_queue, field_name).desc())
                else:
                    if hasattr(Newsletter_queue, sort):
                        query = query.order_by(getattr(Newsletter_queue, sort))
            else:
                query = query.order_by(Newsletter_queue.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching newsletter_queue list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Newsletter_queue]:
        """Update newsletter_queue"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Newsletter_queue {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated newsletter_queue {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating newsletter_queue {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete newsletter_queue"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Newsletter_queue {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted newsletter_queue {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting newsletter_queue {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Newsletter_queue]:
        """Get newsletter_queue by any field"""
        try:
            if not hasattr(Newsletter_queue, field_name):
                raise ValueError(f"Field {field_name} does not exist on Newsletter_queue")
            result = await self.db.execute(
                select(Newsletter_queue).where(getattr(Newsletter_queue, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching newsletter_queue by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Newsletter_queue]:
        """Get list of newsletter_queues filtered by field"""
        try:
            if not hasattr(Newsletter_queue, field_name):
                raise ValueError(f"Field {field_name} does not exist on Newsletter_queue")
            result = await self.db.execute(
                select(Newsletter_queue)
                .where(getattr(Newsletter_queue, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Newsletter_queue.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching newsletter_queues by {field_name}: {str(e)}")
            raise