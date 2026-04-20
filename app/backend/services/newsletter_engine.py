import logging
import uuid
import random
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession

from models.subscribers import Subscribers
from models.subscriber_preferences import Subscriber_preferences
from models.newsletter_templates import Newsletter_templates
from models.newsletter_queue import Newsletter_queue
from models.newsletter_sent_history import Newsletter_sent_history
from models.articles import Articles

logger = logging.getLogger(__name__)


class NewsletterEngineService:
    """High-level newsletter engine service with compose, send, analytics, A/B testing."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ---- Dashboard Stats ----
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get newsletter dashboard statistics."""
        try:
            # Subscriber counts by status
            total_q = await self.db.execute(select(func.count(Subscribers.id)))
            total_subscribers = total_q.scalar() or 0

            active_q = await self.db.execute(
                select(func.count(Subscribers.id)).where(Subscribers.status == "active")
            )
            active_subscribers = active_q.scalar() or 0

            pending_q = await self.db.execute(
                select(func.count(Subscribers.id)).where(Subscribers.status == "pending")
            )
            pending_subscribers = pending_q.scalar() or 0

            unsubscribed_q = await self.db.execute(
                select(func.count(Subscribers.id)).where(Subscribers.status == "unsubscribed")
            )
            unsubscribed_count = unsubscribed_q.scalar() or 0

            bounced_q = await self.db.execute(
                select(func.count(Subscribers.id)).where(Subscribers.status == "bounced")
            )
            bounced_count = bounced_q.scalar() or 0

            # Queue stats
            total_sent_q = await self.db.execute(
                select(func.count(Newsletter_queue.id)).where(Newsletter_queue.status == "sent")
            )
            total_sent = total_sent_q.scalar() or 0

            total_pending_q = await self.db.execute(
                select(func.count(Newsletter_queue.id)).where(Newsletter_queue.status == "pending")
            )
            total_pending = total_pending_q.scalar() or 0

            total_opened_q = await self.db.execute(
                select(func.count(Newsletter_queue.id)).where(Newsletter_queue.opened_at.isnot(None))
            )
            total_opened = total_opened_q.scalar() or 0

            total_clicked_q = await self.db.execute(
                select(func.count(Newsletter_queue.id)).where(Newsletter_queue.clicked_at.isnot(None))
            )
            total_clicked = total_clicked_q.scalar() or 0

            # Calculate rates
            open_rate = round((total_opened / total_sent * 100), 1) if total_sent > 0 else 0
            click_rate = round((total_clicked / total_sent * 100), 1) if total_sent > 0 else 0
            bounce_rate = round((bounced_count / total_subscribers * 100), 1) if total_subscribers > 0 else 0

            # Template count
            template_q = await self.db.execute(
                select(func.count(Newsletter_templates.id)).where(Newsletter_templates.is_active == True)
            )
            active_templates = template_q.scalar() or 0

            return {
                "total_subscribers": total_subscribers,
                "active_subscribers": active_subscribers,
                "pending_subscribers": pending_subscribers,
                "unsubscribed_count": unsubscribed_count,
                "bounced_count": bounced_count,
                "total_sent": total_sent,
                "total_pending": total_pending,
                "open_rate": open_rate,
                "click_rate": click_rate,
                "bounce_rate": bounce_rate,
                "active_templates": active_templates,
            }
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {e}")
            raise

    # ---- Subscriber Management ----
    async def subscribe(self, email: str, first_name: str = "", last_name: str = "") -> Dict[str, Any]:
        """Public subscribe endpoint."""
        try:
            existing = await self.db.execute(
                select(Subscribers).where(Subscribers.email == email)
            )
            sub = existing.scalar_one_or_none()
            if sub:
                if sub.status == "unsubscribed":
                    sub.status = "active"
                    sub.email_verified = True
                    sub.updated_at = datetime.now()
                    await self.db.commit()
                    return {"message": "Welcome back! You've been re-subscribed.", "status": "resubscribed"}
                return {"message": "You're already subscribed!", "status": "already_subscribed"}

            token = str(uuid.uuid4())
            new_sub = Subscribers(
                email=email,
                first_name=first_name or None,
                last_name=last_name or None,
                status="active",
                email_verified=True,
                verification_token=token,
                timezone="America/New_York",
                preferred_send_time="08:00",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            self.db.add(new_sub)
            await self.db.commit()
            return {"message": "Successfully subscribed!", "status": "subscribed"}
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error subscribing: {e}")
            raise

    async def bulk_import_subscribers(self, subscribers_data: List[Dict[str, str]]) -> Dict[str, Any]:
        """Bulk import subscribers from CSV-like data."""
        imported = 0
        skipped = 0
        errors = []
        for row in subscribers_data:
            email = row.get("email", "").strip()
            if not email or "@" not in email:
                errors.append(f"Invalid email: {email}")
                continue
            try:
                existing = await self.db.execute(
                    select(Subscribers).where(Subscribers.email == email)
                )
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue
                new_sub = Subscribers(
                    email=email,
                    first_name=row.get("first_name", "").strip() or None,
                    last_name=row.get("last_name", "").strip() or None,
                    status="active",
                    email_verified=True,
                    timezone=row.get("timezone", "America/New_York"),
                    preferred_send_time="08:00",
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                )
                self.db.add(new_sub)
                imported += 1
            except Exception as e:
                errors.append(f"Error importing {email}: {str(e)}")
        await self.db.commit()
        return {"imported": imported, "skipped": skipped, "errors": errors}

    async def export_subscribers(self) -> List[Dict[str, Any]]:
        """Export all subscribers as list of dicts."""
        result = await self.db.execute(
            select(Subscribers).order_by(Subscribers.created_at.desc())
        )
        items = result.scalars().all()
        return [
            {
                "email": s.email,
                "first_name": s.first_name or "",
                "last_name": s.last_name or "",
                "status": s.status or "pending",
                "email_verified": s.email_verified or False,
                "timezone": s.timezone or "",
                "created_at": s.created_at.isoformat() if s.created_at else "",
            }
            for s in items
        ]

    # ---- Compose & Send ----
    async def compose_and_queue(
        self,
        subject: str,
        template_key: str,
        article_ids: List[int],
        scheduled_date: str,
        newsletter_type: str = "manual",
    ) -> Dict[str, Any]:
        """Compose a newsletter and queue it for all active subscribers."""
        try:
            # Get active subscribers
            result = await self.db.execute(
                select(Subscribers).where(Subscribers.status == "active")
            )
            active_subs = result.scalars().all()
            if not active_subs:
                return {"message": "No active subscribers to send to.", "queued": 0}

            article_ids_str = ",".join(str(aid) for aid in article_ids)
            queued = 0

            for sub in active_subs:
                # Check dedup: skip if already sent these articles today
                existing = await self.db.execute(
                    select(Newsletter_sent_history).where(
                        and_(
                            Newsletter_sent_history.subscriber_id == sub.id,
                            Newsletter_sent_history.sent_date == scheduled_date,
                        )
                    )
                )
                already_sent_articles = {h.article_id for h in existing.scalars().all()}
                new_article_ids = [aid for aid in article_ids if aid not in already_sent_articles]

                if not new_article_ids:
                    continue

                queue_item = Newsletter_queue(
                    subscriber_id=sub.id,
                    subject=subject,
                    template_key=template_key,
                    article_ids=",".join(str(a) for a in new_article_ids),
                    scheduled_date=scheduled_date,
                    status="pending",
                    created_at=datetime.now(),
                )
                self.db.add(queue_item)
                queued += 1

            await self.db.commit()
            return {
                "message": f"Newsletter queued for {queued} subscribers.",
                "queued": queued,
                "total_active": len(active_subs),
            }
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error composing newsletter: {e}")
            raise

    async def process_queue(self, batch_size: int = 50) -> Dict[str, Any]:
        """Process pending queue items (mock send)."""
        try:
            result = await self.db.execute(
                select(Newsletter_queue)
                .where(Newsletter_queue.status == "pending")
                .order_by(Newsletter_queue.created_at)
                .limit(batch_size)
            )
            items = result.scalars().all()
            sent = 0
            failed = 0

            for item in items:
                # Mock send: randomly succeed (95%) or fail (5%)
                success = random.random() > 0.05
                now = datetime.now()
                if success:
                    item.status = "sent"
                    item.sent_at = now
                    # Mock open/click tracking (60% open, 25% click)
                    if random.random() < 0.6:
                        item.opened_at = now + timedelta(hours=random.randint(1, 24))
                    if random.random() < 0.25:
                        item.clicked_at = now + timedelta(hours=random.randint(2, 48))

                    # Record sent history for dedup
                    if item.article_ids:
                        for aid_str in item.article_ids.split(","):
                            try:
                                aid = int(aid_str.strip())
                                history = Newsletter_sent_history(
                                    subscriber_id=item.subscriber_id,
                                    article_id=aid,
                                    sent_date=item.scheduled_date or now.strftime("%Y-%m-%d"),
                                    newsletter_type="manual",
                                    created_at=now,
                                )
                                self.db.add(history)
                            except ValueError:
                                pass
                    sent += 1
                else:
                    item.status = "failed"
                    failed += 1

            await self.db.commit()
            return {"sent": sent, "failed": failed, "total_processed": len(items)}
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error processing queue: {e}")
            raise

    # ---- A/B Testing ----
    async def create_ab_test(
        self,
        subject_a: str,
        subject_b: str,
        template_key_a: str,
        template_key_b: str,
        article_ids: List[int],
        scheduled_date: str,
        test_percentage: int = 20,
    ) -> Dict[str, Any]:
        """Create an A/B test by splitting subscribers."""
        try:
            result = await self.db.execute(
                select(Subscribers).where(Subscribers.status == "active")
            )
            active_subs = list(result.scalars().all())
            if len(active_subs) < 4:
                return {"message": "Need at least 4 active subscribers for A/B testing.", "created": False}

            random.shuffle(active_subs)
            test_count = max(4, int(len(active_subs) * test_percentage / 100))
            test_subs = active_subs[:test_count]
            half = len(test_subs) // 2
            group_a = test_subs[:half]
            group_b = test_subs[half:]

            ab_test_id = int(datetime.now().timestamp())
            article_ids_str = ",".join(str(a) for a in article_ids)
            queued = 0

            for sub in group_a:
                q = Newsletter_queue(
                    subscriber_id=sub.id,
                    subject=subject_a,
                    template_key=template_key_a,
                    article_ids=article_ids_str,
                    scheduled_date=scheduled_date,
                    status="pending",
                    ab_test_id=ab_test_id,
                    ab_variant="A",
                    created_at=datetime.now(),
                )
                self.db.add(q)
                queued += 1

            for sub in group_b:
                q = Newsletter_queue(
                    subscriber_id=sub.id,
                    subject=subject_b,
                    template_key=template_key_b,
                    article_ids=article_ids_str,
                    scheduled_date=scheduled_date,
                    status="pending",
                    ab_test_id=ab_test_id,
                    ab_variant="B",
                    created_at=datetime.now(),
                )
                self.db.add(q)
                queued += 1

            await self.db.commit()
            return {
                "message": f"A/B test created with {queued} recipients.",
                "created": True,
                "ab_test_id": ab_test_id,
                "group_a_count": len(group_a),
                "group_b_count": len(group_b),
            }
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating A/B test: {e}")
            raise

    async def get_ab_test_results(self, ab_test_id: int) -> Dict[str, Any]:
        """Get A/B test results."""
        try:
            result = await self.db.execute(
                select(Newsletter_queue).where(Newsletter_queue.ab_test_id == ab_test_id)
            )
            items = result.scalars().all()
            if not items:
                return {"message": "A/B test not found.", "results": None}

            variants: Dict[str, Dict[str, int]] = {"A": {"sent": 0, "opened": 0, "clicked": 0}, "B": {"sent": 0, "opened": 0, "clicked": 0}}
            for item in items:
                v = item.ab_variant or "A"
                if v in variants:
                    if item.status == "sent":
                        variants[v]["sent"] += 1
                    if item.opened_at:
                        variants[v]["opened"] += 1
                    if item.clicked_at:
                        variants[v]["clicked"] += 1

            for v in variants.values():
                v["open_rate"] = round(v["opened"] / v["sent"] * 100, 1) if v["sent"] > 0 else 0
                v["click_rate"] = round(v["clicked"] / v["sent"] * 100, 1) if v["sent"] > 0 else 0

            # Determine winner
            winner = "A" if variants["A"].get("open_rate", 0) >= variants["B"].get("open_rate", 0) else "B"

            return {
                "ab_test_id": ab_test_id,
                "variants": variants,
                "winner": winner,
                "total_recipients": len(items),
            }
        except Exception as e:
            logger.error(f"Error getting A/B test results: {e}")
            raise

    async def get_ab_tests_list(self) -> List[Dict[str, Any]]:
        """Get list of all A/B tests."""
        try:
            result = await self.db.execute(
                select(Newsletter_queue.ab_test_id)
                .where(Newsletter_queue.ab_test_id.isnot(None))
                .distinct()
                .order_by(Newsletter_queue.ab_test_id.desc())
                .limit(20)
            )
            test_ids = [row[0] for row in result.all()]
            tests = []
            for tid in test_ids:
                test_result = await self.get_ab_test_results(tid)
                if test_result.get("results") is not None or test_result.get("variants"):
                    tests.append(test_result)
            return tests
        except Exception as e:
            logger.error(f"Error getting A/B tests list: {e}")
            raise

    # ---- Recent Campaigns ----
    async def get_recent_campaigns(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent newsletter campaigns (grouped by subject + scheduled_date)."""
        try:
            result = await self.db.execute(
                select(
                    Newsletter_queue.subject,
                    Newsletter_queue.template_key,
                    Newsletter_queue.scheduled_date,
                    func.count(Newsletter_queue.id).label("total"),
                    func.sum(case((Newsletter_queue.status == "sent", 1), else_=0)).label("sent_count"),
                    func.sum(case((Newsletter_queue.opened_at.isnot(None), 1), else_=0)).label("opened_count"),
                    func.sum(case((Newsletter_queue.clicked_at.isnot(None), 1), else_=0)).label("clicked_count"),
                )
                .group_by(Newsletter_queue.subject, Newsletter_queue.template_key, Newsletter_queue.scheduled_date)
                .order_by(Newsletter_queue.scheduled_date.desc())
                .limit(limit)
            )
            rows = result.all()
            campaigns = []
            for row in rows:
                total = row.total or 0
                sent = row.sent_count or 0
                opened = row.opened_count or 0
                clicked = row.clicked_count or 0
                campaigns.append({
                    "subject": row.subject,
                    "template_key": row.template_key,
                    "scheduled_date": row.scheduled_date,
                    "total_recipients": total,
                    "sent": sent,
                    "opened": opened,
                    "clicked": clicked,
                    "open_rate": round(opened / sent * 100, 1) if sent > 0 else 0,
                    "click_rate": round(clicked / sent * 100, 1) if sent > 0 else 0,
                })
            return campaigns
        except Exception as e:
            logger.error(f"Error getting recent campaigns: {e}")
            raise

    # ---- Get published articles for compose ----
    async def get_published_articles(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get published articles for newsletter composition."""
        try:
            result = await self.db.execute(
                select(Articles)
                .where(Articles.is_published == True)
                .order_by(Articles.published_at.desc())
                .limit(limit)
            )
            items = result.scalars().all()
            return [
                {
                    "id": a.id,
                    "title": a.title,
                    "summary": a.summary or "",
                    "category": a.category or "",
                    "published_at": a.published_at.isoformat() if a.published_at else "",
                    "slug": a.slug or "",
                }
                for a in items
            ]
        except Exception as e:
            logger.error(f"Error getting published articles: {e}")
            raise