from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String


class Authors(Base):
    __tablename__ = "authors"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    bio = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    role = Column(String, nullable=False)
    expertise_tags = Column(String, nullable=True)
    social_twitter = Column(String, nullable=True)
    social_linkedin = Column(String, nullable=True)
    social_website = Column(String, nullable=True)
    is_verified = Column(Boolean, nullable=True)
    contract_status = Column(String, nullable=True)
    payment_rate_type = Column(String, nullable=True)
    payment_rate_value = Column(Float, nullable=True)
    total_articles = Column(Integer, nullable=True)
    total_published = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)