from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Subscriber_preferences(Base):
    __tablename__ = "subscriber_preferences"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    subscriber_id = Column(Integer, nullable=False)
    category_name = Column(String, nullable=True)
    newsletter_frequency = Column(String, nullable=True)
    template_preference = Column(String, nullable=True)
    content_format = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)