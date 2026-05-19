from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tickets

app = FastAPI(title="Paggo Case API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # DEVELOPMENT ONLY — restrict to Vercel URL before production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets.router)

@app.get("/health")
def health():
    return {"status": "ok"}
