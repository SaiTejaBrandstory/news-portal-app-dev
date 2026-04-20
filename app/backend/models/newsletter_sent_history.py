from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Newsletter_sent_history(Base):
    __tablename__ = "newsletter_sent_history"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    subscriber_id = Column(Integer, nullable=True)
    article_id = Column(Integer, nullable=True)
    sent_date = Column(String, nullable=True)
    newsletter_type = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)