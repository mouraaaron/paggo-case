from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tickets, audit, agent

app = FastAPI(title="Paggo Case API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # DEVELOPMENT ONLY — restrict to Vercel URL before production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets.router)
app.include_router(audit.router)
app.include_router(agent.router)

@app.get("/health")
def health():
    return {"status": "ok"}
