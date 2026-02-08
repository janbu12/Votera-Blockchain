from pydantic import BaseModel, Field


class VerifyRequest(BaseModel):
    nim: str = Field(min_length=1)
    referenceUrl: str = Field(min_length=1)
    selfieDataUrl: str = Field(min_length=1)
    threshold: float = Field(ge=0, le=1)
    requestId: str = Field(min_length=1)


class VerifyResponse(BaseModel):
    ok: bool
    provider: str
    providerRequestId: str
    livenessPassed: bool
    faceMatchScore: float = Field(ge=0, le=1)
    approved: bool
    reasonCode: str | None
    modelVersion: str
