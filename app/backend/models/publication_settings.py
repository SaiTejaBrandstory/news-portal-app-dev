from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Publication_settings(Base):
    __tablename__ = "publication_settings"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    setting_key = Column(String, nullable=False)
    setting_value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)