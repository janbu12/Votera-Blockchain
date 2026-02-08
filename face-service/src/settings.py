import os


class Settings:
    host = os.getenv("FACE_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("FACE_SERVICE_PORT", "4200"))
    token = os.getenv("FACE_SERVICE_TOKEN", "change-this-face-token")
    log_level = os.getenv("FACE_SERVICE_LOG_LEVEL", "info").lower()
    # facenet pretrain options: vggface2 | casia-webface
    model_name = os.getenv("FACE_SERVICE_MODEL_NAME", "vggface2")
    timeout_ms = max(1000, int(os.getenv("FACE_SERVICE_TIMEOUT_MS", "8000")))


settings = Settings()
