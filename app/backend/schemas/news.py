from pydantic import BaseModel
from typing import Optional, List


class FetchAndRewriteRequest(BaseModel):
    category: str = "general"
    max_articles: int = 5
    auto_publish: bool = False
    rewrite_style: str = "professional"


class FetchAndRewriteResponse(BaseModel):
    id: int
    title: str
    summary: Optional[str] = None
    category: str
    is_published: bool
    slug: str


class FetchAndRewriteResult(BaseModel):
    articles: List[FetchAndRewriteResponse]
    total_fetched: int
    message: str


class TogglePublishRequest(BaseModel):
    article_id: int
    is_published: bool


class TogglePublishResponse(BaseModel):
    id: int
    is_published: bool
    published_at: Optional[str] = None
    message: str


class SettingsUpdateRequest(BaseModel):
    setting_key: str
    setting_value: str


class SettingsResponse(BaseModel):
    id: int
    setting_key: str
    setting_value: str
    description: Optional[str] = None


# --- Web Scraper schemas ---

class ScrapeRequest(BaseModel):
    urls: List[str]
    category: str = "general"
    rewrite_style: str = "professional"
    words_length: str = "medium"  # short (~150 words), medium (~300 words), long (~500 words)
    auto_publish: bool = False


class ScrapedArticlePreview(BaseModel):
    """A single scraped (and optionally rewritten) article preview."""
    url: str
    original_title: str
    original_content: str
    rewritten_title: str
    rewritten_summary: str
    rewritten_content: str
    source_name: str
    image_url: Optional[str] = None
    error: Optional[str] = None


class ScrapeResult(BaseModel):
    articles: List[ScrapedArticlePreview]
    total_scraped: int
    total_errors: int
    message: str


class ScrapeApproveRequest(BaseModel):
    """Approve scraped articles to save them to the database."""
    articles: List[ScrapedArticlePreview]
    category: str = "general"
    auto_publish: bool = False


# --- Manual Submit schemas ---

class ManualSubmitRequest(BaseModel):
    """Manually submit a new article."""
    title: str
    summary: Optional[str] = None
    content: str
    category: str = "general"
    source_url: Optional[str] = None
    author: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[str] = None
    published_at: Optional[str] = None
    is_published: bool = False


class ManualSubmitResponse(BaseModel):
    id: int
    title: str
    slug: str
    category: str
    is_published: bool
    message: str


# --- Search schemas ---

class SearchRequest(BaseModel):
    """Search articles."""
    query: str
    limit: int = 20


class SearchResultItem(BaseModel):
    id: int
    title: str
    summary: Optional[str] = None
    content: str
    category: str
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    slug: str
    tags: Optional[str] = None
    is_published: Optional[bool] = None
    published_at: Optional[str] = None
    created_at: Optional[str] = None
    relevance_source: str = "content"

    class Config:
        from_attributes = True


class SearchResult(BaseModel):
    articles: List[SearchResultItem]
    total: int
    query: str
    message: str