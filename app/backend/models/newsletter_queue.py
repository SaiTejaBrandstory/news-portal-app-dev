from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Newsletter_queue(Base):
    __tablename__ = "newsletter_queue"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    subscriber_id = Column(Integer, nullable=True)
    subject = Column(String, nullable=True)
    template_key = Column(String, nullable=True)
    article_ids = Column(String, nullable=True)
    scheduled_date = Column(String, nullable=True)
    status = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    ab_test_id = Column(Integer, nullable=True)
    ab_variant = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)