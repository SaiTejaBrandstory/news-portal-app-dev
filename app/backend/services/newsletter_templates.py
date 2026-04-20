import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.newsletter_templates import Newsletter_templates

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Newsletter_templatesService:
    """Service layer for Newsletter_templates operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Newsletter_templates]:
        """Create a new newsletter_templates"""
        try:
            obj = Newsletter_templates(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created newsletter_templates with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating newsletter_templates: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Newsletter_templates]:
        """Get newsletter_templates by ID"""
        try:
            query = select(Newsletter_templates).where(Newsletter_templates.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching newsletter_templates {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of newsletter_templatess"""
        try:
            query = select(Newsletter_templates)
            count_query = select(func.count(Newsletter_templates.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Newsletter_templates, field):
                        query = query.where(getattr(Newsletter_templates, field) == value)
                        count_query = count_query.where(getattr(Newsletter_templates, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Newsletter_templates, field_name):
                        query = query.order_by(getattr(Newsletter_templates, field_name).desc())
                else:
                    if hasattr(Newsletter_templates, sort):
                        query = query.order_by(getattr(Newsletter_templates, sort))
            else:
                query = query.order_by(Newsletter_templates.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching newsletter_templates list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Newsletter_templates]:
        """Update newsletter_templates"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Newsletter_templates {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated newsletter_templates {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating newsletter_templates {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete newsletter_templates"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Newsletter_templates {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted newsletter_templates {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting newsletter_templates {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Newsletter_templates]:
        """Get newsletter_templates by any field"""
        try:
            if not hasattr(Newsletter_templates, field_name):
                raise ValueError(f"Field {field_name} does not exist on Newsletter_templates")
            result = await self.db.execute(
                select(Newsletter_templates).where(getattr(Newsletter_templates, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching newsletter_templates by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Newsletter_templates]:
        """Get list of newsletter_templatess filtered by field"""
        try:
            if not hasattr(Newsletter_templates, field_name):
                raise ValueError(f"Field {field_name} does not exist on Newsletter_templates")
            result = await self.db.execute(
                select(Newsletter_templates)
                .where(getattr(Newsletter_templates, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Newsletter_templates.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching newsletter_templatess by {field_name}: {str(e)}")
            raise