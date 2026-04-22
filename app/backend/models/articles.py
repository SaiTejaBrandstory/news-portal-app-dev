from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Articles(Base):
    __tablename__ = "articles"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    article_code = Column(String, nullable=True, unique=True, index=True)
    title = Column(String, nullable=False)
    original_title = Column(String, nullable=True)
    content = Column(String, nullable=False)
    original_content = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    category = Column(String, nullable=False)
    author = Column(String, nullable=True)
    min_read = Column(Integer, nullable=True)
    source_name = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    slug = Column(String, nullable=False)
    tags = Column(String, nullable=True)
    is_published = Column(Boolean, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)