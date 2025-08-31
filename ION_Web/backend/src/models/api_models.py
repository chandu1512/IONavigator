from pydantic import BaseModel
from typing import Optional


class TraceMetadata(BaseModel):
    trace_name: str
    user_id: str
    upload_date: Optional[str]


class UploadTraceResponse(BaseModel):
    success: bool
    message: str


class APIResponse(BaseModel):
    status: str
    data: Optional[dict]
