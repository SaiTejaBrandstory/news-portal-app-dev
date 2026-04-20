from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Newsletter_templates(Base):
    __tablename__ = "newsletter_templates"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name = Column(String, nullable=False)
    template_key = Column(String, nullable=False)
    description = Column(String, nullable=True)
    html_content = Column(String, nullable=True)
    text_content = Column(String, nullable=True)
    preview_style = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)