import logging
import os
import re
import httpx
from datetime import datetime
from typing import Dict, Any, List
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func as sa_func

from models.articles import Articles
from services.aihub import AIHubService
from schemas.aihub import GenTxtRequest, ChatMessage

logger = logging.getLogger(__name__)


async def _next_article_code(db: AsyncSession) -> str:
    """Generate the next article code like ART-001, ART-002, etc."""
    result = await db.execute(
        select(sa_func.max(Articles.id))
    )
    max_id = result.scalar() or 0
    return f"ART-{max_id + 1:03d}"

CATEGORY_IMAGES = {
    "technology": "https://mgx-backend-cdn.metadl.com/generate/images/910092/2026-04-16/mxdrcgyaae7a/news-placeholder-tech.png",
    "business": "https://mgx-backend-cdn.metadl.com/generate/images/910092/2026-04-16/mxdrffyaae7q/news-placeholder-business.png",
    "world": "https://mgx-backend-cdn.metadl.com/generate/images/910092/2026-04-16/mxdreziaafaq/news-placeholder-world.png",
    "general": "https://mgx-backend-cdn.metadl.com/generate/images/910092/2026-04-16/mxdrcziaafaa/hero-news-banner.png",
}

# Map admin categories to Google News search queries
CATEGORY_QUERIES = {
    "technology": "technology OR tech OR AI OR software",
    "business": "business OR economy OR finance OR markets",
    "world": "world news OR international OR global affairs",
    "science": "science OR research OR discovery",
    "health": "health OR medicine OR healthcare",
    "sports": "sports OR football OR basketball OR soccer",
    "entertainment": "entertainment OR movies OR music OR celebrity",
    "general": "breaking news OR top stories",
}

APIFY_SYNC_URL = "https://api.apify.com/v2/acts/lhotanova~google-news-scraper/run-sync-get-dataset-items"


def generate_slug(title: str) -> str:
    """Generate a URL-friendly slug from a title."""
    slug = title.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug[:80].rstrip('-')
    timestamp = int(datetime.now().timestamp())
    return f"{slug}-{timestamp}"


def _parse_apify_items(items: list) -> List[Dict[str, Any]]:
    """Parse Apify Google News Scraper response items into a normalized format.

    The scraper returns items with fields: title, link, source, publishedAt, image.
    The 'source' field can be a string or a dict with 'name'/'title' keys.
    """
    articles = []
    for item in items:
        if not isinstance(item, dict):
            continue

        title = (item.get("title") or "").strip()
        if not title:
            continue

        # Source can be a string or dict
        source_raw = item.get("source", "Unknown")
        if isinstance(source_raw, dict):
            source_name = source_raw.get("name") or source_raw.get("title") or "Unknown"
        elif isinstance(source_raw, str):
            source_name = source_raw
        else:
            source_name = "Unknown"

        # Use snippet/description if available, otherwise use title
        content = item.get("snippet") or item.get("description") or title

        articles.append({
            "title": title,
            "description": content,
            "content": content,
            "source_name": source_name or "Unknown",
            "source_url": item.get("link") or item.get("url") or "",
            "image_url": item.get("image") or item.get("thumbnail") or "",
        })

    return articles


class NewsService:
    """Service for fetching news from Apify Google News Scraper and rewriting with AI."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.apify_token = os.environ.get("APIFY_TOKEN", "")
        self.ai_service = AIHubService()

    async def fetch_news(self, category: str = "general", max_articles: int = 10) -> List[Dict[str, Any]]:
        """Fetch news from Apify Google News Scraper using the synchronous endpoint.

        Uses POST to run-sync-get-dataset-items which runs the actor synchronously
        and returns dataset items directly in the response.
        Falls back to sample data if the token is missing or the request fails.
        """
        if not self.apify_token:
            logger.warning("APIFY_TOKEN not configured, using sample data")
            return self._get_sample_news(category, max_articles)

        query = CATEGORY_QUERIES.get(category, CATEGORY_QUERIES["general"])
        logger.info(f"Fetching news from Apify: category='{category}', query='{query}', max={max_articles}")

        # Actor input payload passed as POST body (application/json)
        payload = {
            "query": query,
            "language": "en",
            "maxItems": max_articles,
            "openEndedDateRange": "7d",
        }

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    APIFY_SYNC_URL,
                    params={"token": self.apify_token},
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                data = response.json()

            # The sync endpoint returns dataset items directly as a JSON array
            logger.info(
                f"Apify sync response: type={type(data).__name__}, "
                f"length={len(data) if isinstance(data, list) else 'N/A'}"
            )

            if isinstance(data, list):
                articles = _parse_apify_items(data)
            elif isinstance(data, dict):
                # Handle unexpected wrapper objects
                articles = _parse_apify_items(
                    data.get("items", data.get("data", []))
                )
            else:
                articles = []

            if articles:
                logger.info(f"Parsed {len(articles)} articles for '{category}'")
                return articles[:max_articles]

            logger.warning("Apify returned 0 parseable articles, using sample data")
            return self._get_sample_news(category, max_articles)

        except httpx.TimeoutException:
            logger.error("Apify sync request timed out (>180s)")
            return self._get_sample_news(category, max_articles)
        except httpx.HTTPStatusError as e:
            logger.error(f"Apify HTTP error {e.response.status_code}: {e.response.text[:500]}")
            return self._get_sample_news(category, max_articles)
        except Exception as e:
            logger.error(f"Error fetching news from Apify: {e}")
            return self._get_sample_news(category, max_articles)

    def _get_sample_news(self, category: str, max_articles: int) -> List[Dict[str, Any]]:
        """Return sample news data when API token is not available."""
        samples = [
            {
                "title": "AI Revolution: New Language Models Transform Content Creation Industry",
                "description": "The latest advancements in artificial intelligence are reshaping how businesses create and distribute content across digital platforms.",
                "content": "The latest advancements in artificial intelligence are reshaping how businesses create and distribute content across digital platforms. Major tech companies have unveiled new language models that can generate human-quality text, translate languages, and summarize complex documents in seconds. Industry experts predict these tools will fundamentally change the content creation landscape within the next few years, enabling smaller businesses to compete with larger corporations in digital marketing and content production.",
                "source_name": "TechDaily",
                "source_url": "https://example.com/ai-revolution",
                "image_url": CATEGORY_IMAGES.get("technology", ""),
            },
            {
                "title": "Global Markets Rally as Economic Indicators Show Strong Recovery",
                "description": "Stock markets worldwide experienced significant gains as new economic data suggests a robust recovery trajectory.",
                "content": "Stock markets worldwide experienced significant gains as new economic data suggests a robust recovery trajectory. The S&P 500 rose 2.3% while European markets followed suit with similar gains. Analysts point to strong employment figures, rising consumer confidence, and increased manufacturing output as key drivers of the rally. Central banks have signaled a cautious approach to monetary policy, balancing growth support with inflation management.",
                "source_name": "Financial Times",
                "source_url": "https://example.com/markets-rally",
                "image_url": CATEGORY_IMAGES.get("business", ""),
            },
            {
                "title": "Climate Summit Reaches Historic Agreement on Carbon Emissions",
                "description": "World leaders have agreed to unprecedented carbon reduction targets at the latest international climate conference.",
                "content": "World leaders have agreed to unprecedented carbon reduction targets at the latest international climate conference. The agreement commits participating nations to reduce carbon emissions by 50% by 2035 and achieve net-zero by 2050. The deal includes a $100 billion annual fund to help developing nations transition to clean energy. Environmental groups have cautiously welcomed the agreement while calling for stronger enforcement mechanisms.",
                "source_name": "World News Network",
                "source_url": "https://example.com/climate-summit",
                "image_url": CATEGORY_IMAGES.get("world", ""),
            },
            {
                "title": "Breakthrough in Quantum Computing Promises New Era of Technology",
                "description": "Scientists have achieved a major milestone in quantum computing that could revolutionize data processing and encryption.",
                "content": "Scientists have achieved a major milestone in quantum computing that could revolutionize data processing and encryption. The new quantum processor demonstrated the ability to solve complex problems in minutes that would take traditional supercomputers thousands of years. This breakthrough has significant implications for drug discovery, financial modeling, and cybersecurity. Tech companies are racing to develop practical applications of this technology.",
                "source_name": "Science Today",
                "source_url": "https://example.com/quantum-breakthrough",
                "image_url": CATEGORY_IMAGES.get("technology", ""),
            },
            {
                "title": "Space Exploration: New Mission to Mars Launches Successfully",
                "description": "The latest Mars mission has successfully launched, carrying advanced instruments to search for signs of ancient life.",
                "content": "The latest Mars mission has successfully launched, carrying advanced instruments to search for signs of ancient life on the Red Planet. The spacecraft will travel for seven months before entering Mars orbit and deploying a rover equipped with cutting-edge sensors. Scientists hope to collect samples that could provide definitive evidence of past microbial life. The mission represents a collaborative effort between multiple space agencies.",
                "source_name": "Space News",
                "source_url": "https://example.com/mars-mission",
                "image_url": CATEGORY_IMAGES.get("world", ""),
            },
            {
                "title": "Healthcare Innovation: New Treatment Shows Promise Against Chronic Diseases",
                "description": "A revolutionary treatment approach is showing remarkable results in clinical trials for multiple chronic conditions.",
                "content": "A revolutionary treatment approach is showing remarkable results in clinical trials for multiple chronic conditions. The therapy, which uses a combination of gene editing and targeted drug delivery, has demonstrated significant improvements in patients with diabetes, heart disease, and autoimmune disorders. Researchers believe this could transform the treatment landscape for millions of patients worldwide. Regulatory agencies are fast-tracking the approval process.",
                "source_name": "Health Journal",
                "source_url": "https://example.com/healthcare-innovation",
                "image_url": CATEGORY_IMAGES.get("general", ""),
            },
        ]
        return samples[:max_articles]

    async def rewrite_article(
        self,
        title: str,
        content: str,
        style: str = "professional",
        words_length: str = "medium",
    ) -> Dict[str, str]:
        """Rewrite a news article using AI."""
        style_prompts = {
            "professional": "Rewrite in a professional, authoritative journalistic tone suitable for a premium news portal.",
            "casual": "Rewrite in a casual, engaging tone that's easy to read and share on social media.",
            "formal": "Rewrite in a formal, academic tone with precise language and detailed analysis.",
        }

        length_prompts = {
            "short": "Keep the article concise, approximately 100-150 words (1-2 short paragraphs).",
            "medium": "Write a moderately detailed article, approximately 250-350 words (3-4 paragraphs).",
            "long": "Write a comprehensive, in-depth article, approximately 500-700 words (5-7 paragraphs with detailed analysis).",
        }

        style_instruction = style_prompts.get(style, style_prompts["professional"])
        length_instruction = length_prompts.get(words_length, length_prompts["medium"])

        prompt = f"""You are a professional news editor. {style_instruction}

{length_instruction}

Rewrite the following news article. Provide:
1. A compelling, SEO-friendly headline (max 80 characters)
2. Exactly 3 to 4 key points that summarise the most important facts of the article.
   - Each key point must be ONE clear, complete sentence (20-30 words).
   - Written so a busy reader instantly understands the story without reading the full article.
   - No vague filler. Every point must contain a specific fact, number, name, or outcome.
   - Format: one point per line, each starting with "• "
3. The full rewritten article (well-structured with clear flow)

Original Title: {title}
Original Content: {content}

Respond in this EXACT format (no extra text before or after):
HEADLINE: [your headline]
SUMMARY:
• [key point 1]
• [key point 2]
• [key point 3]
• [key point 4 — optional if genuinely needed]
ARTICLE:
[your full article]"""

        try:
            request = GenTxtRequest(
                messages=[
                    ChatMessage(role="system", content="You are a professional news editor and content rewriter. Always respond in the exact format requested."),
                    ChatMessage(role="user", content=prompt),
                ],
                model="deepseek-v3.2",
            )
            response = await self.ai_service.gentxt(request)
            result_text = response.content

            # Parse the response
            headline = title
            summary = ""
            article = content

            if "HEADLINE:" in result_text:
                parts = result_text.split("HEADLINE:", 1)[1]
                if "SUMMARY:" in parts:
                    headline = parts.split("SUMMARY:", 1)[0].strip()
                    parts = parts.split("SUMMARY:", 1)[1]
                    if "ARTICLE:" in parts:
                        summary = parts.split("ARTICLE:", 1)[0].strip()
                        article = parts.split("ARTICLE:", 1)[1].strip()
                    else:
                        summary = parts.strip()
                else:
                    headline = parts.strip()[:80]

            return {
                "title": headline[:200],
                "summary": summary[:800],  # enough for 3-4 bullet points
                "content": article,
            }
        except Exception as e:
            logger.error(f"Error rewriting article: {e}")
            return {
                "title": title,
                "summary": "",
                "content": content,
            }

    async def fetch_and_rewrite(
        self,
        category: str = "general",
        max_articles: int = 5,
        auto_publish: bool = False,
        rewrite_style: str = "professional",
    ) -> List[Dict[str, Any]]:
        """Fetch news, rewrite with AI, and store in database."""
        raw_articles = await self.fetch_news(category, max_articles)
        logger.info(f"fetch_news returned {len(raw_articles)} raw articles for '{category}'")
        results = []
        skipped_duplicates = 0

        for raw in raw_articles:
            # Check if article already exists by source_url
            if raw.get("source_url"):
                existing = await self.db.execute(
                    select(Articles).where(Articles.source_url == raw["source_url"])
                )
                if existing.scalar_one_or_none():
                    skipped_duplicates += 1
                    logger.info(f"Skipping duplicate: {raw['title']}")
                    continue

            # Rewrite with AI
            rewritten = await self.rewrite_article(
                raw["title"],
                raw["content"],
                rewrite_style,
            )

            # Determine image
            image_url = raw.get("image_url", "") or CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["general"])

            # Create article record
            now = datetime.now()
            code = await _next_article_code(self.db)
            article_data = {
                "title": rewritten["title"],
                "article_code": code,
                "original_title": raw["title"],
                "content": rewritten["content"],
                "original_content": raw["content"],
                "summary": rewritten["summary"],
                "category": category,
                "source_name": raw.get("source_name", "Unknown"),
                "source_url": raw.get("source_url", ""),
                "image_url": image_url,
                "slug": generate_slug(rewritten["title"]),
                "is_published": auto_publish,
                "published_at": now if auto_publish else None,
                "created_at": now,
            }

            article = Articles(**article_data)
            self.db.add(article)
            await self.db.commit()
            await self.db.refresh(article)

            results.append({
                "id": article.id,
                "title": article.title,
                "summary": article.summary,
                "category": article.category,
                "is_published": article.is_published,
                "slug": article.slug,
            })

        if skipped_duplicates > 0:
            logger.info(f"Skipped {skipped_duplicates} duplicate articles")

        return results

    # ------------------------------------------------------------------ #
    #  Manual Submit
    # ------------------------------------------------------------------ #

    async def manual_create_article(
        self,
        title: str,
        content: str,
        category: str = "general",
        summary: str | None = None,
        source_url: str | None = None,
        author: str | None = None,
        image_url: str | None = None,
        tags: str | None = None,
        published_at_str: str | None = None,
        is_published: bool = False,
    ) -> Dict[str, Any]:
        """Manually create a new article and save to the database."""
        now = datetime.now()

        # Parse published_at if provided
        pub_at = None
        if published_at_str:
            try:
                pub_at = datetime.fromisoformat(published_at_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pub_at = now if is_published else None
        elif is_published:
            pub_at = now

        code = await _next_article_code(self.db)
        article_data = {
            "title": title,
            "article_code": code,
            "original_title": None,
            "content": content,
            "original_content": None,
            "summary": summary or content[:160],
            "category": category,
            "source_name": author or "Manual",
            "source_url": source_url,
            "image_url": image_url or CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["general"]),
            "slug": generate_slug(title),
            "tags": tags,
            "is_published": is_published,
            "published_at": pub_at,
            "created_at": now,
        }

        article = Articles(**article_data)
        self.db.add(article)
        await self.db.commit()
        await self.db.refresh(article)

        logger.info(f"Manually created article: '{title}' (id={article.id})")

        return {
            "id": article.id,
            "title": article.title,
            "slug": article.slug,
            "category": article.category,
            "is_published": article.is_published,
        }

    async def search_articles(
        self,
        query: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search published articles across title, summary, content, tags, category.
        
        Returns results sorted by relevance: tag matches first, then title, then content.
        """
        from sqlalchemy import or_, case

        q = query.lower().strip()
        if not q:
            return []

        # Build search conditions across multiple fields
        search_filter = or_(
            Articles.title.ilike(f"%{q}%"),
            Articles.summary.ilike(f"%{q}%"),
            Articles.content.ilike(f"%{q}%"),
            Articles.tags.ilike(f"%{q}%"),
            Articles.category.ilike(f"%{q}%"),
        )

        # Relevance scoring: tags > title > category > summary > content
        relevance = case(
            (Articles.tags.ilike(f"%{q}%"), 1),
            (Articles.title.ilike(f"%{q}%"), 2),
            (Articles.category.ilike(f"%{q}%"), 3),
            (Articles.summary.ilike(f"%{q}%"), 4),
            else_=5,
        )

        stmt = (
            select(Articles, relevance.label("relevance_rank"))
            .where(Articles.is_published == True)
            .where(search_filter)
            .order_by(relevance, Articles.published_at.desc())
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        articles = []
        for row in rows:
            article = row[0]
            rank = row[1]
            relevance_source = {1: "tags", 2: "title", 3: "category", 4: "summary"}.get(rank, "content")
            articles.append({
                "id": article.id,
                "title": article.title,
                "summary": article.summary,
                "content": article.content,
                "category": article.category,
                "source_name": article.source_name,
                "source_url": article.source_url,
                "image_url": article.image_url,
                "slug": article.slug,
                "tags": article.tags,
                "is_published": article.is_published,
                "published_at": str(article.published_at) if article.published_at else None,
                "created_at": str(article.created_at) if article.created_at else None,
                "relevance_source": relevance_source,
            })

        return articles

    # ------------------------------------------------------------------ #
    #  Web Scraper
    # ------------------------------------------------------------------ #

    async def _ai_extract_from_html(self, url: str, raw_html: str) -> Dict[str, Any]:
        """Use AI to extract article content from raw HTML when BeautifulSoup fails.

        This is a fallback method that sends a truncated version of the HTML to an
        AI model and asks it to extract the article title, content, and image URL.
        """
        # Truncate HTML to avoid token limits (keep first ~15k chars)
        truncated_html = raw_html[:15000]

        prompt = f"""Extract the main news article from this HTML page.

URL: {url}

HTML (truncated):
{truncated_html}

Respond in this exact format:
TITLE: [the article headline]
IMAGE: [the main article image URL, or NONE if not found]
CONTENT:
[the full article text, paragraphs separated by blank lines]"""

        try:
            request = GenTxtRequest(
                messages=[
                    ChatMessage(
                        role="system",
                        content=(
                            "You are an expert web content extractor. Extract the main article "
                            "content from the provided HTML. Ignore navigation, ads, footers, "
                            "and sidebars. Return only the article text."
                        ),
                    ),
                    ChatMessage(role="user", content=prompt),
                ],
                model="deepseek-v3.2",
                max_tokens=4096,
            )
            response = await self.ai_service.gentxt(request)
            return self._parse_ai_extraction_response(response.content, url)

        except Exception as e:
            logger.error(f"AI extraction from HTML failed for {url}: {e}")
            return {"title": "", "content": "", "image_url": "", "error": f"AI extraction failed: {str(e)}"}

    async def _ai_extract_from_url(self, url: str) -> Dict[str, Any]:
        """Use AI to write an article based on the URL when HTTP fetch fails entirely.

        This fallback is used when the site returns 403, times out, or otherwise
        blocks the scraper. The AI model uses its knowledge to produce an article
        based on the URL structure and any information it can infer.
        """
        prompt = f"""I need you to write a news article based on this URL. The website blocked
our scraper so we cannot access the page directly.

URL: {url}

Based on the URL structure, the domain, and any knowledge you have about this article or topic,
please write a factual news article. If you recognize this specific article, reproduce its key
facts and information as accurately as possible. If you don't recognize the exact article, write
a well-researched article about the topic suggested by the URL.

Respond in this exact format:
TITLE: [a compelling article headline]
AUTHOR: [the likely author or publication name, or UNKNOWN]
DATE: [the likely publication date in YYYY-MM-DD format, or UNKNOWN]
IMAGE: NONE
CONTENT:
[the full article text, 3-5 paragraphs with factual information]"""

        try:
            request = GenTxtRequest(
                messages=[
                    ChatMessage(
                        role="system",
                        content=(
                            "You are a knowledgeable news journalist with expertise in current affairs. "
                            "When given a URL, you can infer the topic from the URL path and domain, "
                            "and write an accurate, factual article about it. Always be truthful — "
                            "if you're unsure about specific details, write about the general topic "
                            "rather than fabricating specific facts."
                        ),
                    ),
                    ChatMessage(role="user", content=prompt),
                ],
                model="deepseek-v3.2",
                max_tokens=4096,
            )
            response = await self.ai_service.gentxt(request)
            return self._parse_ai_extraction_response(response.content, url)

        except Exception as e:
            logger.error(f"AI extraction from URL failed for {url}: {e}")
            return {"title": "", "content": "", "image_url": "", "error": f"AI extraction from URL failed: {str(e)}"}

    def _parse_ai_extraction_response(self, result_text: str, url: str) -> Dict[str, Any]:
        """Parse the structured AI response into a dict with title, content, image_url."""
        title = ""
        image_url = ""
        content = ""

        if "TITLE:" in result_text:
            parts = result_text.split("TITLE:", 1)[1]

            # Extract title (ends at AUTHOR:, IMAGE:, or CONTENT:)
            for next_key in ["AUTHOR:", "DATE:", "IMAGE:", "CONTENT:"]:
                if next_key in parts:
                    title = parts.split(next_key, 1)[0].strip()
                    parts = parts.split(next_key, 1)[1]
                    break
            else:
                title = parts.strip()[:120]

            # Skip AUTHOR and DATE fields if present
            for skip_key in ["DATE:", "IMAGE:"]:
                if skip_key in parts:
                    parts = parts.split(skip_key, 1)[1]

            # Now parts should start with image or content
            if "CONTENT:" in parts:
                img_line = parts.split("CONTENT:", 1)[0].strip()
                if img_line and img_line.upper() != "NONE":
                    image_url = img_line
                content = parts.split("CONTENT:", 1)[1].strip()
            else:
                content = parts.strip()

        if content and len(content) > 50:
            logger.info(f"AI extracted article from {url}: '{title[:60]}' ({len(content)} chars)")
            return {
                "title": title,
                "content": content,
                "image_url": image_url,
                "error": None,
            }

        return {"title": "", "content": "", "image_url": "", "error": "AI could not extract meaningful content."}

    async def scrape_url(self, url: str) -> Dict[str, Any]:
        """Scrape article content from a single URL using httpx + BeautifulSoup.

        Falls back to AI-based extraction when traditional scraping fails to
        extract meaningful content. If HTTP fetch itself fails (403, timeout, etc.),
        falls back to AI URL-based extraction.

        Returns a dict with title, content, source_name, image_url, or error.
        """
        result: Dict[str, Any] = {
            "url": url,
            "title": "",
            "content": "",
            "source_name": "",
            "image_url": "",
            "error": None,
        }

        # Validate URL
        try:
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https"):
                result["error"] = "Invalid URL scheme. Use http or https."
                return result
            if not parsed.netloc:
                result["error"] = "Invalid URL: no domain found."
                return result
        except Exception:
            result["error"] = "Malformed URL."
            return result

        result["source_name"] = parsed.netloc.replace("www.", "")

        # --- Step 1: Try HTTP fetch ---
        raw_html = ""
        http_failed = False
        http_error_msg = ""
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/125.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                    "Cache-Control": "max-age=0",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                },
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                result["error"] = f"URL returned non-HTML content: {content_type}"
                return result

            raw_html = resp.text

        except httpx.TimeoutException:
            http_failed = True
            http_error_msg = f"Request timed out for {parsed.netloc}"
            logger.warning(f"{http_error_msg}, will try AI fallback")
        except httpx.HTTPStatusError as e:
            http_failed = True
            http_error_msg = f"HTTP {e.response.status_code} from {parsed.netloc}"
            logger.warning(f"{http_error_msg}, will try AI fallback")
            # Do NOT keep error page HTML — it's usually "Access Denied" / captcha pages
            # that would pollute BS extraction. Let the AI URL fallback handle it.
        except Exception as e:
            http_failed = True
            http_error_msg = f"Failed to fetch {parsed.netloc}: {str(e)}"
            logger.warning(f"{http_error_msg}, will try AI fallback")

        # --- Step 2: If HTTP failed entirely, try AI URL-based extraction ---
        if http_failed and not raw_html:
            logger.info(f"HTTP fetch failed for {url}, trying AI URL-based extraction...")
            ai_result = await self._ai_extract_from_url(url)

            if ai_result.get("content") and not ai_result.get("error"):
                result["title"] = ai_result["title"]
                result["content"] = ai_result["content"]
                result["image_url"] = ai_result.get("image_url", "")
                logger.info(f"AI URL extraction succeeded for {url}")
                return result
            else:
                # AI also failed
                result["error"] = (
                    f"{http_error_msg}. AI fallback also failed. "
                    "The site may block scrapers and the article may not be in AI's knowledge."
                )
                return result

        # --- Step 3: BeautifulSoup extraction ---
        try:
            soup = BeautifulSoup(raw_html, "lxml")

            # --- Title ---
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                result["title"] = og_title["content"].strip()
            elif soup.title and soup.title.string:
                result["title"] = soup.title.string.strip()
            else:
                h1 = soup.find("h1")
                result["title"] = h1.get_text(strip=True) if h1 else ""

            # --- Image ---
            og_image = soup.find("meta", property="og:image")
            if og_image and og_image.get("content"):
                result["image_url"] = og_image["content"]

            # --- Content extraction ---
            # Try <article> tag first, then fall back to largest text block
            article_tag = soup.find("article")
            if article_tag:
                paragraphs = article_tag.find_all("p")
            else:
                paragraphs = soup.find_all("p")

            # Filter out very short paragraphs (nav items, footers, etc.)
            text_parts = []
            for p in paragraphs:
                text = p.get_text(strip=True)
                if len(text) > 40:
                    text_parts.append(text)

            result["content"] = "\n\n".join(text_parts)
        except Exception as e:
            logger.warning(f"BeautifulSoup parsing error for {url}: {e}")
            result["content"] = ""

        # --- Step 3b: Detect error/block pages in extracted content ---
        if result["content"]:
            content_lower = result["content"].lower()
            block_phrases = [
                "access denied", "403 forbidden", "captcha", "please verify",
                "are you a robot", "enable javascript", "browser check",
                "cloudflare", "just a moment", "checking your browser",
                "please enable cookies", "bot detection", "automated access",
                "request blocked", "security check",
            ]
            if any(phrase in content_lower for phrase in block_phrases):
                logger.info(f"Detected block/error page content for {url}, clearing BS result")
                result["content"] = ""
                result["title"] = ""

        # --- Step 4: AI Fallback if BS extraction was insufficient ---
        if not result["content"] or len(result["content"]) < 100:
            logger.info(f"BS extraction insufficient for {url}, trying AI fallback...")

            # Try HTML-based AI extraction first if we have HTML
            if raw_html and len(raw_html) > 500:
                ai_result = await self._ai_extract_from_html(url, raw_html)
            else:
                ai_result = {"content": "", "error": "No HTML available"}

            # If HTML-based AI failed, try URL-based AI
            if not ai_result.get("content") or ai_result.get("error"):
                logger.info(f"AI HTML extraction failed for {url}, trying URL-based extraction...")
                ai_result = await self._ai_extract_from_url(url)

            if ai_result.get("content") and not ai_result.get("error"):
                result["title"] = ai_result["title"] or result["title"]
                result["content"] = ai_result["content"]
                if ai_result.get("image_url"):
                    result["image_url"] = result["image_url"] or ai_result["image_url"]
                result["error"] = None
                logger.info(f"AI fallback succeeded for {url}")
            else:
                # All methods failed
                bs_had_something = bool(result["content"])
                if not bs_had_something:
                    result["error"] = (
                        "Could not extract content from this page. "
                        "The site may use JavaScript rendering or block scrapers."
                    )
                    return result

        if not result["title"] and result["content"]:
            result["title"] = result["content"][:80] + "..."

        logger.info(f"Scraped '{result['title'][:60]}' from {parsed.netloc}")
        return result

    async def _scrape_and_rewrite_single(
        self,
        url: str,
        rewrite_style: str,
        words_length: str,
    ) -> Dict[str, Any]:
        """Scrape and AI-rewrite a single URL. Returns a preview dict."""
        url = url.strip()
        scraped = await self.scrape_url(url)

        if scraped.get("error"):
            return {
                "url": url,
                "original_title": "",
                "original_content": "",
                "rewritten_title": "",
                "rewritten_summary": "",
                "rewritten_content": "",
                "source_name": scraped.get("source_name", ""),
                "image_url": None,
                "error": scraped["error"],
            }

        rewritten = await self.rewrite_article(
            scraped["title"],
            scraped["content"],
            rewrite_style,
            words_length,
        )

        return {
            "url": url,
            "original_title": scraped["title"],
            "original_content": scraped["content"][:2000],
            "rewritten_title": rewritten["title"],
            "rewritten_summary": rewritten["summary"],
            "rewritten_content": rewritten["content"],
            "source_name": scraped["source_name"],
            "image_url": scraped.get("image_url") or None,
            "error": None,
        }

    async def scrape_and_rewrite(
        self,
        urls: List[str],
        category: str = "general",
        rewrite_style: str = "professional",
        words_length: str = "medium",
    ) -> List[Dict[str, Any]]:
        """Scrape multiple URLs in parallel, rewrite each with AI, return previews."""
        import asyncio

        clean_urls = [u.strip() for u in urls if u.strip()]
        if not clean_urls:
            return []

        tasks = [
            self._scrape_and_rewrite_single(url, rewrite_style, words_length)
            for url in clean_urls
        ]
        # Run all URLs concurrently — 4 links takes the same time as 1
        results = await asyncio.gather(*tasks, return_exceptions=True)

        previews: List[Dict[str, Any]] = []
        for url, result in zip(clean_urls, results):
            if isinstance(result, Exception):
                previews.append({
                    "url": url,
                    "original_title": "",
                    "original_content": "",
                    "rewritten_title": "",
                    "rewritten_summary": "",
                    "rewritten_content": "",
                    "source_name": "",
                    "image_url": None,
                    "error": str(result),
                })
            else:
                previews.append(result)

        return previews

    async def save_scraped_articles(
        self,
        articles: List[Dict[str, Any]],
        category: str = "general",
        auto_publish: bool = False,
    ) -> List[Dict[str, Any]]:
        """Save approved scraped articles to the database."""
        results: List[Dict[str, Any]] = []

        for art in articles:
            if art.get("error"):
                continue

            # Skip if source URL already exists
            source_url = art.get("url", "")
            if source_url:
                existing = await self.db.execute(
                    select(Articles).where(Articles.source_url == source_url)
                )
                if existing.scalar_one_or_none():
                    logger.info(f"Skipping duplicate scraped article: {art.get('rewritten_title', '')}")
                    continue

            image_url = art.get("image_url") or CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["general"])
            now = datetime.now()
            code = await _next_article_code(self.db)

            article_data = {
                "title": art.get("rewritten_title", art.get("original_title", "Untitled")),
                "article_code": code,
                "original_title": art.get("original_title", ""),
                "content": art.get("rewritten_content", art.get("original_content", "")),
                "original_content": art.get("original_content", ""),
                "summary": art.get("rewritten_summary", ""),
                "category": category,
                "source_name": art.get("source_name", "Unknown"),
                "source_url": source_url,
                "image_url": image_url,
                "slug": generate_slug(art.get("rewritten_title", "article")),
                "is_published": auto_publish,
                "published_at": now if auto_publish else None,
                "created_at": now,
            }

            article = Articles(**article_data)
            self.db.add(article)
            await self.db.commit()
            await self.db.refresh(article)

            results.append({
                "id": article.id,
                "title": article.title,
                "summary": article.summary,
                "category": article.category,
                "is_published": article.is_published,
                "slug": article.slug,
            })

        return results