from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Subscribers(Base):
    __tablename__ = "subscribers"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    email = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    status = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=True)
    verification_token = Column(String, nullable=True)
    timezone = Column(String, nullable=True)
    preferred_send_time = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)