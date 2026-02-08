import base64
import binascii
import io
import logging
from typing import Any

import numpy as np
import requests
import torch
from facenet_pytorch import InceptionResnetV1, MTCNN
from PIL import Image

from settings import settings

LOGGER = logging.getLogger("face-service")
MODEL_VERSION = f"facenet-mtcnn-{settings.model_name}-cpu"
PROVIDER_NAME = "face-local-facenet"

DEVICE = torch.device("cpu")
FACE_DETECTOR = MTCNN(
    image_size=160,
    margin=0,
    keep_all=True,
    post_process=True,
    device=DEVICE,
)
FACE_EMBEDDER = InceptionResnetV1(pretrained=settings.model_name).eval().to(DEVICE)


def _clamp(value: float) -> float:
    if not np.isfinite(value):
        return 0.0
    if value < 0:
        return 0.0
    if value > 1:
        return 1.0
    return float(value)


def _decode_image_bytes(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError("BAD_IMAGE")
    return image


def decode_selfie_data_url(data_url: str) -> Image.Image:
    if not data_url.startswith("data:image/"):
        raise ValueError("BAD_IMAGE")
    if "," not in data_url:
        raise ValueError("BAD_IMAGE")
    header, payload = data_url.split(",", 1)
    if ";base64" not in header:
        raise ValueError("BAD_IMAGE")
    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("BAD_IMAGE") from exc
    return _decode_image_bytes(image_bytes)


def fetch_reference_image(reference_url: str) -> Image.Image:
    timeout_sec = max(1.0, settings.timeout_ms / 1000)
    try:
        response = requests.get(reference_url, timeout=timeout_sec)
    except requests.RequestException as exc:
        raise RuntimeError("REFERENCE_FETCH_FAILED") from exc

    if response.status_code != 200:
        raise RuntimeError("REFERENCE_FETCH_FAILED")

    return _decode_image_bytes(response.content)


def _extract_single_face_embedding(
    image: Image.Image, image_kind: str
) -> tuple[np.ndarray | None, str | None]:
    try:
        faces = FACE_DETECTOR(image)
    except Exception as exc:  # pragma: no cover - model runtime errors
        LOGGER.error("face detection failed for %s: %s", image_kind, exc)
        return None, "BAD_IMAGE"

    if faces is None:
        if image_kind == "selfie":
            return None, "NO_FACE_SELFIE"
        return None, "NO_FACE_REFERENCE"

    if faces.ndim == 3:
        faces = faces.unsqueeze(0)

    if faces.shape[0] == 0:
        if image_kind == "selfie":
            return None, "NO_FACE_SELFIE"
        return None, "NO_FACE_REFERENCE"

    if faces.shape[0] > 1:
        if image_kind == "selfie":
            return None, "MULTI_FACE_SELFIE"
        return None, "MULTI_FACE_REFERENCE"

    face_tensor = faces[0].unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        embedding = FACE_EMBEDDER(face_tensor).cpu().numpy()[0]

    vector = np.asarray(embedding, dtype=np.float32)
    norm = np.linalg.norm(vector)
    if norm == 0:
        return None, "BAD_IMAGE"
    normalized = vector / norm
    return normalized, None


def compute_similarity(selfie_embedding: np.ndarray, reference_embedding: np.ndarray) -> float:
    cosine = float(np.dot(selfie_embedding, reference_embedding))
    return _clamp(cosine)


def verify_face(
    nim: str,
    reference_url: str,
    selfie_data_url: str,
    threshold: float,
    request_id: str,
) -> dict[str, Any]:
    del nim  # kept for observability correlation on caller side

    try:
        selfie_image = decode_selfie_data_url(selfie_data_url)
    except ValueError as exc:
        reason_code = str(exc)
        return {
            "ok": True,
            "provider": PROVIDER_NAME,
            "providerRequestId": request_id,
            "livenessPassed": False,
            "faceMatchScore": 0.0,
            "approved": False,
            "reasonCode": reason_code,
            "modelVersion": MODEL_VERSION,
        }

    try:
        reference_image = fetch_reference_image(reference_url)
    except RuntimeError as exc:
        reason_code = str(exc)
        return {
            "ok": True,
            "provider": PROVIDER_NAME,
            "providerRequestId": request_id,
            "livenessPassed": False,
            "faceMatchScore": 0.0,
            "approved": False,
            "reasonCode": reason_code,
            "modelVersion": MODEL_VERSION,
        }
    except ValueError:
        return {
            "ok": True,
            "provider": PROVIDER_NAME,
            "providerRequestId": request_id,
            "livenessPassed": False,
            "faceMatchScore": 0.0,
            "approved": False,
            "reasonCode": "BAD_IMAGE",
            "modelVersion": MODEL_VERSION,
        }

    selfie_embedding, selfie_error = _extract_single_face_embedding(selfie_image, "selfie")
    if selfie_error:
        return {
            "ok": True,
            "provider": PROVIDER_NAME,
            "providerRequestId": request_id,
            "livenessPassed": False,
            "faceMatchScore": 0.0,
            "approved": False,
            "reasonCode": selfie_error,
            "modelVersion": MODEL_VERSION,
        }

    reference_embedding, reference_error = _extract_single_face_embedding(
        reference_image, "reference"
    )
    if reference_error:
        return {
            "ok": True,
            "provider": PROVIDER_NAME,
            "providerRequestId": request_id,
            "livenessPassed": False,
            "faceMatchScore": 0.0,
            "approved": False,
            "reasonCode": reference_error,
            "modelVersion": MODEL_VERSION,
        }

    similarity = compute_similarity(selfie_embedding, reference_embedding)
    approved = similarity >= threshold

    return {
        "ok": True,
        "provider": PROVIDER_NAME,
        "providerRequestId": request_id,
        "livenessPassed": True,
        "faceMatchScore": similarity,
        "approved": approved,
        "reasonCode": None if approved else "LOW_SCORE",
        "modelVersion": MODEL_VERSION,
    }
