import os
import uvicorn
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.main import app

# Disable browser caching during local development
@app.middleware("http")
async def no_cache_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response

# For local development, we want to mimic the Vercel routing
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

if os.path.exists(FRONTEND_DIR):
    # Mount static assets
    app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")
    app.mount("/assets", StaticFiles(directory="frontend/assets"), name="assets")

    # Specific file routes to match vercel.json rewrites
    @app.get("/")
    async def serve_landing():
        return FileResponse("frontend/landing/index.html")

    @app.get("/styles.css")
    async def serve_landing_styles():
        return FileResponse("frontend/landing/styles.css")

    @app.get("/app.js")
    async def serve_landing_app():
        return FileResponse("frontend/landing/app.js")

    @app.get("/documentation.html")
    async def serve_docs():
        return FileResponse("frontend/docs/documentation.html")
        
    @app.get("/docs.css")
    async def serve_docs_css():
        return FileResponse("frontend/docs/docs.css")
        
    @app.get("/docs.js")
    async def serve_docs_js():
        return FileResponse("frontend/docs/docs.js")
        
    @app.get("/api/")
    async def serve_api_index():
        return FileResponse("frontend/api/index.html")

    @app.get("/api/app.js")
    async def serve_api_app():
        return FileResponse("frontend/api/app.js")

    @app.get("/api/styles.css")
    async def serve_api_styles():
        return FileResponse("frontend/api/styles.css")

    @app.get("/playground/")
    async def serve_playground_index():
        return FileResponse("frontend/playground/index.html")

    @app.get("/playground/app.js")
    async def serve_playground_app():
        return FileResponse("frontend/playground/app.js")

    @app.get("/playground/styles.css")
    async def serve_playground_styles():
        return FileResponse("frontend/playground/styles.css")

if __name__ == "__main__":
    print("Starting development server...")
    print("Frontend: http://127.0.0.1:8000/")
    print("API Docs: http://127.0.0.1:8000/docs")
    uvicorn.run("dev:app", host="127.0.0.1", port=8000, reload=True, reload_dirs=["backend"])
