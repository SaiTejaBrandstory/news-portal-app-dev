import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.authors import Authors

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class AuthorsService:
    """Service layer for Authors operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Authors]:
        """Create a new authors"""
        try:
            obj = Authors(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created authors with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating authors: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Authors]:
        """Get authors by ID"""
        try:
            query = select(Authors).where(Authors.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching authors {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of authorss"""
        try:
            query = select(Authors)
            count_query = select(func.count(Authors.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Authors, field):
                        query = query.where(getattr(Authors, field) == value)
                        count_query = count_query.where(getattr(Authors, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Authors, field_name):
                        query = query.order_by(getattr(Authors, field_name).desc())
                else:
                    if hasattr(Authors, sort):
                        query = query.order_by(getattr(Authors, sort))
            else:
                query = query.order_by(Authors.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching authors list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Authors]:
        """Update authors"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Authors {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated authors {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating authors {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete authors"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Authors {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted authors {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting authors {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Authors]:
        """Get authors by any field"""
        try:
            if not hasattr(Authors, field_name):
                raise ValueError(f"Field {field_name} does not exist on Authors")
            result = await self.db.execute(
                select(Authors).where(getattr(Authors, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching authors by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Authors]:
        """Get list of authorss filtered by field"""
        try:
            if not hasattr(Authors, field_name):
                raise ValueError(f"Field {field_name} does not exist on Authors")
            result = await self.db.execute(
                select(Authors)
                .where(getattr(Authors, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Authors.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching authorss by {field_name}: {str(e)}")
            raise