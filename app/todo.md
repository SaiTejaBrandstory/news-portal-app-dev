# News Portal App - Development Plan

## Design Guidelines

### Design References
- **BBC News**: Clean, authoritative layout with strong typography
- **The Verge**: Modern, bold design with vibrant accents
- **Style**: Modern News Portal + Dark/Light contrast + Professional

### Color Palette
- Primary: #0F172A (Dark Navy - header/footer)
- Secondary: #1E293B (Slate - cards)
- Accent: #EF4444 (Red - breaking news, CTAs)
- Accent2: #3B82F6 (Blue - links, categories)
- Background: #F8FAFC (Light gray - main bg)
- Text: #0F172A (Dark), #64748B (Muted)
- White: #FFFFFF (Cards, content areas)

### Typography
- Heading1: Inter font-weight 800 (40px) - Article titles
- Heading2: Inter font-weight 700 (28px) - Section headers
- Body: Inter font-weight 400 (16px) - Article content
- Caption: Inter font-weight 500 (14px) - Meta info

### Key Component Styles
- **Cards**: White bg, subtle shadow, 12px rounded, hover lift effect
- **Buttons**: Red accent for primary CTAs, blue for secondary
- **Navigation**: Dark navy header with white text
- **Categories**: Pill-shaped badges with colored backgrounds

### Images to Generate
1. **hero-news-banner.jpg** - Modern newsroom with screens showing global news, dramatic lighting (photorealistic)
2. **news-placeholder-tech.jpg** - Abstract technology concept with circuit boards and digital elements (photorealistic)
3. **news-placeholder-world.jpg** - Globe with connected network lines, world map concept (photorealistic)
4. **news-placeholder-business.jpg** - Modern city skyline with financial district at golden hour (photorealistic)

---

## Architecture Overview

### Backend
- **Database Tables**: `articles` (stores fetched & rewritten news), `settings` (publication volume controls)
- **Custom API**: `/api/v1/news/fetch-and-rewrite` - Fetches news from NewsAPI, rewrites with AI (deepseek-v3.2), stores in DB
- **Custom API**: `/api/v1/news/settings` - GET/PUT publication settings (volume, categories, auto-publish)
- **Custom API**: `/api/v1/news/publish` - Toggle article publish status
- **AI Model**: deepseek-v3.2 for rewriting news articles (cost effective, text only)

### Frontend
- **Homepage** (`Index.tsx`): Public news portal with hero, featured articles, category filters, SEO meta
- **Admin Panel** (`Admin.tsx`): Auth-protected dashboard to control publication volume, trigger fetch, manage articles
- **Article Detail** (`ArticleDetail.tsx`): Individual article page with full content, SEO structured data

---

## Development Tasks

1. Create database tables (articles, settings) using BackendManager.create_tables
2. Insert initial settings data using BackendManager.insert_table_data
3. Generate placeholder images using ImageCreator.generate_images
4. Create backend custom API services (news fetching, AI rewriting, settings management)
5. Build frontend homepage - public news portal with hero, article grid, category filters
6. Build frontend article detail page with SEO structured data
7. Build frontend admin panel - auth-protected dashboard for publication control
8. Run lint, build, and CheckUI

## Files to Create
- `backend/services/news_service.py` - News fetching, AI rewriting logic
- `backend/routers/news.py` - API endpoints for news operations
- `backend/schemas/news.py` - Pydantic models for news API
- `frontend/src/pages/Index.tsx` - Public news homepage
- `frontend/src/pages/ArticleDetail.tsx` - Article detail page
- `frontend/src/pages/Admin.tsx` - Admin dashboard
- `frontend/src/components/ArticleCard.tsx` - Reusable article card
- `frontend/src/App.tsx` - Updated routes