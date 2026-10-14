from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field, field_validator

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

    @field_validator("evidence")
    @classmethod
    def evidence_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError(
                "Evidence must contain non-whitespace text."
            )
        return value

class Analysis( BaseModel ):
    document_type: str
    summary: str
    findings: list[Finding]

class GroundedFinding( Finding ):
    grounding_status: Literal["VERIFIED", "RECOVERED"]

class UnresolvedFinding(Finding):
    grounding_status: Literal["UNRESOLVED"] = "UNRESOLVED"
    reason: Literal[
        "PARTIAL_MATCH",
        "FULL_EVIDENCE_NOT_LOCATED_UNIQUELY",
    ]
    matched_excerpt: str | None = None
    matched_page: int | None = Field(default=None, ge=1)

class AnalysisResponse( BaseModel ):
    document_type: str
    summary: str
    findings: list[GroundedFinding]
    unresolved_count: int = Field(ge=0)
    highlighted_pdf_base64: str
    unresolved_findings: list[UnresolvedFinding] = Field(default_factory=list)