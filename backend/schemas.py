from enum import Enum
from pydantic import BaseModel, Field

class AttentionLevel( str, Enum ):
    HIGH = "HIGH ATTENTION"
    REVIEW = "REVIEW"
    ROUTINE = "ROUTINE"

class Finding( BaseModel ):
    category: str
    attention_level: AttentionLevel
    evidence: str
    page: int = Field(ge=1)
    explanation: str
    why_it_matters: str

class Analysis( BaseModel ):
    document_type: str
    summary: str
    findings: list[Finding]