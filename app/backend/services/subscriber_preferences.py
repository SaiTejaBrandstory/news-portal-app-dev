import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.subscriber_preferences import Subscriber_preferences

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Subscriber_preferencesService:
    """Service layer for Subscriber_preferences operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Subscriber_preferences]:
        """Create a new subscriber_preferences"""
        try:
            obj = Subscriber_preferences(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created subscriber_preferences with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating subscriber_preferences: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Subscriber_preferences]:
        """Get subscriber_preferences by ID"""
        try:
            query = select(Subscriber_preferences).where(Subscriber_preferences.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching subscriber_preferences {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of subscriber_preferencess"""
        try:
            query = select(Subscriber_preferences)
            count_query = select(func.count(Subscriber_preferences.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Subscriber_preferences, field):
                        query = query.where(getattr(Subscriber_preferences, field) == value)
                        count_query = count_query.where(getattr(Subscriber_preferences, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Subscriber_preferences, field_name):
                        query = query.order_by(getattr(Subscriber_preferences, field_name).desc())
                else:
                    if hasattr(Subscriber_preferences, sort):
                        query = query.order_by(getattr(Subscriber_preferences, sort))
            else:
                query = query.order_by(Subscriber_preferences.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching subscriber_preferences list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Subscriber_preferences]:
        """Update subscriber_preferences"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Subscriber_preferences {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated subscriber_preferences {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating subscriber_preferences {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete subscriber_preferences"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Subscriber_preferences {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted subscriber_preferences {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting subscriber_preferences {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Subscriber_preferences]:
        """Get subscriber_preferences by any field"""
        try:
            if not hasattr(Subscriber_preferences, field_name):
                raise ValueError(f"Field {field_name} does not exist on Subscriber_preferences")
            result = await self.db.execute(
                select(Subscriber_preferences).where(getattr(Subscriber_preferences, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching subscriber_preferences by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Subscriber_preferences]:
        """Get list of subscriber_preferencess filtered by field"""
        try:
            if not hasattr(Subscriber_preferences, field_name):
                raise ValueError(f"Field {field_name} does not exist on Subscriber_preferences")
            result = await self.db.execute(
                select(Subscriber_preferences)
                .where(getattr(Subscriber_preferences, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Subscriber_preferences.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching subscriber_preferencess by {field_name}: {str(e)}")
            raise