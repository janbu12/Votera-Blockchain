import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException

from model import MODEL_VERSION, verify_face
from schemas import VerifyRequest, VerifyResponse
from settings import settings

load_dotenv()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("face-service")

app = FastAPI(title="VOTERA Face Service", version="1.0.0")


def mask_url(raw_url: str) -> str:
    split = urlsplit(raw_url)
    if not split.query:
        return raw_url
    query_items = parse_qsl(split.query, keep_blank_values=True)
    masked_items = []
    for key, value in query_items:
        if key.lower() in {"sig", "token", "signature"}:
            masked_items.append((key, "***"))
        else:
            masked_items.append((key, value))
    return urlunsplit((split.scheme, split.netloc, split.path, urlencode(masked_items), split.fragment))


def require_token(token: str | None) -> None:
    if token != settings.token:
        raise HTTPException(status_code=403, detail="Unauthorized service")


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "ok": True,
        "service": "face-service",
        "model": MODEL_VERSION,
        "mode": "cpu",
    }


@app.post("/verify", response_model=VerifyResponse)
def verify(payload: VerifyRequest, x_face_service_token: str | None = Header(default=None)):
    require_token(x_face_service_token)

    logger.info(
        "verify.requested requestId=%s nim=%s referenceUrl=%s threshold=%.2f",
        payload.requestId,
        payload.nim,
        mask_url(payload.referenceUrl),
        payload.threshold,
    )

    try:
        result = verify_face(
            nim=payload.nim,
            reference_url=payload.referenceUrl,
            selfie_data_url=payload.selfieDataUrl,
            threshold=payload.threshold,
            request_id=payload.requestId,
        )
    except Exception as exc:  # pragma: no cover - defensive branch
        logger.exception("verify.failed requestId=%s error=%s", payload.requestId, exc)
        raise HTTPException(status_code=500, detail="Face verification internal error") from exc

    logger.info(
        "verify.completed requestId=%s approved=%s score=%.4f reason=%s model=%s",
        payload.requestId,
        result.get("approved"),
        result.get("faceMatchScore", 0.0),
        result.get("reasonCode"),
        result.get("modelVersion"),
    )
    return result
