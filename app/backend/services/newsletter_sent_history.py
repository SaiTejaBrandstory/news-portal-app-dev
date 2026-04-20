import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.newsletter_sent_history import Newsletter_sent_history

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Newsletter_sent_historyService:
    """Service layer for Newsletter_sent_history operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Newsletter_sent_history]:
        """Create a new newsletter_sent_history"""
        try:
            obj = Newsletter_sent_history(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created newsletter_sent_history with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating newsletter_sent_history: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Newsletter_sent_history]:
        """Get newsletter_sent_history by ID"""
        try:
            query = select(Newsletter_sent_history).where(Newsletter_sent_history.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching newsletter_sent_history {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of newsletter_sent_historys"""
        try:
            query = select(Newsletter_sent_history)
            count_query = select(func.count(Newsletter_sent_history.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Newsletter_sent_history, field):
                        query = query.where(getattr(Newsletter_sent_history, field) == value)
                        count_query = count_query.where(getattr(Newsletter_sent_history, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Newsletter_sent_history, field_name):
                        query = query.order_by(getattr(Newsletter_sent_history, field_name).desc())
                else:
                    if hasattr(Newsletter_sent_history, sort):
                        query = query.order_by(getattr(Newsletter_sent_history, sort))
            else:
                query = query.order_by(Newsletter_sent_history.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching newsletter_sent_history list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Newsletter_sent_history]:
        """Update newsletter_sent_history"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Newsletter_sent_history {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated newsletter_sent_history {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating newsletter_sent_history {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete newsletter_sent_history"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Newsletter_sent_history {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted newsletter_sent_history {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting newsletter_sent_history {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Newsletter_sent_history]:
        """Get newsletter_sent_history by any field"""
        try:
            if not hasattr(Newsletter_sent_history, field_name):
                raise ValueError(f"Field {field_name} does not exist on Newsletter_sent_history")
            result = await self.db.execute(
                select(Newsletter_sent_history).where(getattr(Newsletter_sent_history, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching newsletter_sent_history by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Newsletter_sent_history]:
        """Get list of newsletter_sent_historys filtered by field"""
        try:
            if not hasattr(Newsletter_sent_history, field_name):
                raise ValueError(f"Field {field_name} does not exist on Newsletter_sent_history")
            result = await self.db.execute(
                select(Newsletter_sent_history)
                .where(getattr(Newsletter_sent_history, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Newsletter_sent_history.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching newsletter_sent_historys by {field_name}: {str(e)}")
            raise