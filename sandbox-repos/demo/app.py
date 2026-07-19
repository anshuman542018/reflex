from fastapi import FastAPI
import structlog

log = structlog.get_logger()
app = FastAPI()


@app.get("/")
def root():
    log.info("root_called")
    return {"ok": True}
