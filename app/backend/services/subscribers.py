import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.subscribers import Subscribers

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class SubscribersService:
    """Service layer for Subscribers operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Subscribers]:
        """Create a new subscribers"""
        try:
            obj = Subscribers(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created subscribers with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating subscribers: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Subscribers]:
        """Get subscribers by ID"""
        try:
            query = select(Subscribers).where(Subscribers.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching subscribers {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of subscriberss"""
        try:
            query = select(Subscribers)
            count_query = select(func.count(Subscribers.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Subscribers, field):
                        query = query.where(getattr(Subscribers, field) == value)
                        count_query = count_query.where(getattr(Subscribers, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Subscribers, field_name):
                        query = query.order_by(getattr(Subscribers, field_name).desc())
                else:
                    if hasattr(Subscribers, sort):
                        query = query.order_by(getattr(Subscribers, sort))
            else:
                query = query.order_by(Subscribers.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching subscribers list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Subscribers]:
        """Update subscribers"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Subscribers {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated subscribers {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating subscribers {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete subscribers"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Subscribers {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted subscribers {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting subscribers {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Subscribers]:
        """Get subscribers by any field"""
        try:
            if not hasattr(Subscribers, field_name):
                raise ValueError(f"Field {field_name} does not exist on Subscribers")
            result = await self.db.execute(
                select(Subscribers).where(getattr(Subscribers, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching subscribers by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Subscribers]:
        """Get list of subscriberss filtered by field"""
        try:
            if not hasattr(Subscribers, field_name):
                raise ValueError(f"Field {field_name} does not exist on Subscribers")
            result = await self.db.execute(
                select(Subscribers)
                .where(getattr(Subscribers, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Subscribers.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching subscriberss by {field_name}: {str(e)}")
            raise