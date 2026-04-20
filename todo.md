# Automated Newsletter Engine - Development Plan

## Overview
Add a Newsletter Engine tab to the existing Admin panel with subscriber management, template management, newsletter composition/sending, analytics dashboard, and settings. Uses mock email service (no SendGrid).

## Architecture
- **Backend**: New DB tables via BackendManager + custom API router for newsletter operations
- **Frontend**: New Newsletter tab in Admin.tsx + dedicated NewsletterEngine.tsx component
- **Email**: Mock service that queues and logs but doesn't send; shows "Email provider not configured" notice

## Database Tables (5 new tables)
1. `subscribers` - email, name, status, verification, timezone, preferences
2. `subscriber_preferences` - category preferences, frequency, template choice
3. `newsletter_templates` - 5 professional templates with HTML content
4. `newsletter_queue` - scheduled/sent newsletters with tracking
5. `newsletter_sent_history` - deduplication tracking

## Files to Create/Modify (8 files max)

### Backend (3 files)
1. **`backend/services/newsletter_service.py`** - Newsletter business logic (subscriber CRUD, queue management, analytics, mock email)
2. **`backend/routers/newsletter.py`** - API endpoints for all newsletter operations
3. **`backend/schemas/newsletter.py`** - Pydantic request/response models

### Frontend (3 files)
4. **`frontend/src/pages/Newsletter.tsx`** - Main Newsletter Engine component with sub-tabs
5. **`frontend/src/components/NewsletterTemplatePreview.tsx`** - Template preview renderer
6. **`frontend/src/components/SubscribeWidget.tsx`** - Public subscribe widget for homepage/footer

### Modified Files (2 files)
7. **`frontend/src/pages/Admin.tsx`** - Add Newsletter tab
8. **`frontend/src/pages/Index.tsx`** - Add subscribe widget to footer

## Features by Sub-Tab

### Newsletter Tab Sub-sections:
1. **Dashboard** - Stats cards (subscribers, open rate, CTR, bounce), recent campaigns, subscriber growth chart (mock data)
2. **Subscribers** - CRUD table with search/filter, status management, bulk import/export, verification simulation
3. **Templates** - 5 template cards with live preview, activate/deactivate
4. **Compose & Send** - Article selection, template picker, subject editor, preview, send/schedule
5. **Queue** - Queue status table, rate limiting config
6. **A/B Testing** - Create split tests for subject/template, view results (mock)
7. **Settings** - Site name, sender email, send time, default template, breaking news toggle, unsubscribe URL

## Implementation Order
1. Create DB tables
2. Seed 5 newsletter templates
3. Seed sample subscribers
4. Write backend service + router + schemas
5. Write frontend Newsletter component
6. Write TemplatePreview + SubscribeWidget components
7. Update Admin.tsx + Index.tsx
8. Lint, build, check