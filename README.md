# Paggo Case — Support Ticket Triage System

A full-stack application for triaging ~8,000 support tickets, built with FastAPI + Next.js + Supabase + OpenAI.

## Features

- **Inbox view** — filterable table of all tickets with triage badges and risk scores
- **Ticket detail** — full action panel (status changes, classification, assignment, replies, close) with audit log
- **AI Agent** — conversational assistant powered by GPT-4o-mini with tool calling; requires human confirmation before write actions
- **Triage rules engine** — 5 rules generating a 0-100 risk score per ticket
- **State machine** — enforces valid ticket status transitions (invalid transitions return HTTP 422)
- **Audit log** — every change is recorded with actor, source (USER vs AGENT), old/new values

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI (Python), Pydantic v2 |
| Database | Supabase (PostgreSQL) |
| AI Agent | OpenAI GPT-4o-mini with function calling |
| Hosting | Vercel (frontend) + Render (backend) |

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
# Copy .env.example to .env and fill in values
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
# .env.local already set to http://localhost:8000
npm run dev
```

Open http://localhost:3000

## Environment Variables

### Backend (set in Render dashboard)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for write access) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (your Vercel URL) |

### Frontend (set in Vercel dashboard)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Your Render backend URL (e.g. https://paggo-case-api.onrender.com) |

## Deployment

### Backend → Render

1. Push repo to GitHub
2. Create new Web Service in Render, connect your repo
3. Set root directory to `backend`
4. Set environment variables in Render dashboard
5. Deploy

### Frontend → Vercel

1. Import project in Vercel, set root directory to `frontend`
2. Set `NEXT_PUBLIC_BACKEND_URL` to your Render backend URL
3. Deploy

## Architecture

```
Browser → Next.js (Vercel)
              ↓ fetch
         FastAPI (Render)
              ↓
         Supabase (PostgreSQL)
              ↓ (AI agent only)
         OpenAI API
```
