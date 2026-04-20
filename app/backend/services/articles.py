import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.articles import Articles

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class ArticlesService:
    """Service layer for Articles operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Articles]:
        """Create a new articles"""
        try:
            obj = Articles(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created articles with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating articles: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Articles]:
        """Get articles by ID"""
        try:
            query = select(Articles).where(Articles.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching articles {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of articless"""
        try:
            query = select(Articles)
            count_query = select(func.count(Articles.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Articles, field):
                        query = query.where(getattr(Articles, field) == value)
                        count_query = count_query.where(getattr(Articles, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Articles, field_name):
                        query = query.order_by(getattr(Articles, field_name).desc())
                else:
                    if hasattr(Articles, sort):
                        query = query.order_by(getattr(Articles, sort))
            else:
                query = query.order_by(Articles.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching articles list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Articles]:
        """Update articles"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Articles {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated articles {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating articles {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete articles"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Articles {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted articles {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting articles {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Articles]:
        """Get articles by any field"""
        try:
            if not hasattr(Articles, field_name):
                raise ValueError(f"Field {field_name} does not exist on Articles")
            result = await self.db.execute(
                select(Articles).where(getattr(Articles, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching articles by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Articles]:
        """Get list of articless filtered by field"""
        try:
            if not hasattr(Articles, field_name):
                raise ValueError(f"Field {field_name} does not exist on Articles")
            result = await self.db.execute(
                select(Articles)
                .where(getattr(Articles, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Articles.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching articless by {field_name}: {str(e)}")
            raise