import os, pymupdf, math, base64, httpx
from google import genai
from dotenv import load_dotenv
from google.genai import types
from google.genai import errors
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, HTTPException
from backend.schemas import Analysis, GroundedFinding, UnresolvedFinding, AnalysisResponse, AttentionLevel

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_PAGES = 50
MAX_TEXT_CHARACTERS = 150_000
MAX_EXCERPT_COMPARISONS = 100_000

load_dotenv()
client = genai.Client(
    http_options=types.HttpOptions(
        timeout=60_000,
        retry_options=types.HttpRetryOptions(attempts=1),
    )
)

analysis_model = os.getenv( "GEMINI_MODEL", "gemini-3.5-flash-lite" )
 
analysis_prompt = """You are the document-analysis component of ClauseCheck.
 
Analyze the supplied agreement and identify the parts that deserve attention before the user agrees to the document.
 
### Analysis requirements
 
1. Determine the document type based only on the supplied document.
 
2. Determine which categories are relevant to this particular document. Do not assume a fixed universal category list.
   - Create a category only when the document contains meaningful provisions relevant to that category.
   - Keep the category set focused and avoid unnecessary or overly narrow categories.
   - Prefer broader, meaningful categories over multiple narrowly overlapping categories.
   - Return no more than 8 categories.
   - Do not create categories simply to reach a minimum number.
 
3. Identify meaningful clauses or provisions within the relevant categories.
 
4. For each finding:
   - assign the most appropriate category
   - assign exactly one attention level
   - provide the exact supporting clause or evidence from the document
   - state the page number (from the PAGE markers) the evidence appears on
   - explain the clause in clear, plain language
   - explain why the clause matters to someone reviewing the agreement
 
5. Use only information supported by the supplied document. Do not invent facts, clauses, dates, amounts, obligations, or other document content.
 
6. Every finding must have specific supporting evidence from the document. Do not create a finding when there is no sufficient supporting evidence.
 
### Attention levels
 
Use exactly one of these attention levels:
 
- HIGH ATTENTION — deserves specific examination before agreeing.
- REVIEW — important to understand or verify.
- ROUTINE — no special attention needed based on the document context.
 
These attention levels represent review priorities, not legal judgments. Do not make definitive legal conclusions.
 
### Output
 
Return the analysis using the provided structured output schema."""

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        try:
            await client.aio.aclose()
        finally:
            client.close()


app = FastAPI(
    title="ClauseCheck API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def validate_pdf( file ):
    if ( file.content_type != "application/pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    contents = await file.read(MAX_FILE_SIZE +1)
    if (len(contents) > MAX_FILE_SIZE):
        raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit")

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )
    
    return contents 

def extract_pdf_text(contents):
    try:
        pdf = pymupdf.open(stream=contents, filetype="pdf")
    except pymupdf.FileDataError:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file could not be opened as a valid PDF."
        )

    try:
        if not pdf.is_pdf:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a PDF."
            )

        if pdf.needs_pass:
            raise HTTPException(
                status_code=400,
                detail="Password-protected PDFs are not supported."
            )

        if len(pdf) > MAX_PAGES:
            raise HTTPException(
                status_code=400,
                detail=f"PDF exceeds the {MAX_PAGES}-page limit."
            )

        pages = []
        total_characters = 0

        for page_number, page in enumerate(pdf):
            text = page.get_text()
            total_characters += len(text)

            if total_characters > MAX_TEXT_CHARACTERS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "The PDF contains too much text. "
                        "Please upload a shorter document."
                    )
                )

            pages.append({
                "page_number": page_number + 1,
                "text": text,
            })

        if not any(page["text"].strip() for page in pages):
            raise HTTPException(
                status_code=400,
                detail="No extractable text was found. Please upload a text-based PDF."
            )

        return pdf, pages

    except Exception:
        pdf.close()
        raise

def build_document_text( pages ):
    return "\n\n".join(
        f"PAGE {page['page_number']}\n{page['text']}" for page in pages
    )

def normalize_text( text ):
    text = text.casefold()

    text = text.replace("’", "'")
    text = text.replace("‘", "'")
    text = text.replace("“", '"')
    text = text.replace("”", '"')
    text = text.replace("–", "-")
    text = text.replace("—", "-")

    return " ".join(text.split())

def normalized_search(page, evidence):
    words = page.get_text("words")
    if not words:
        return None

    page_words = [word[4] for word in words]
    evidence_words = normalize_text(evidence).split()

    for i in range(len(page_words) - len(evidence_words) + 1):
        candidate_words = page_words[i:i + len(evidence_words)]
        if normalize_text(" ".join(candidate_words)) == normalize_text(evidence):
            matched_words = words[i:i + len(evidence_words)]
            return [
                pymupdf.Rect(
                    word[0],
                    word[1],
                    word[2],
                    word[3]
                )
                for word in matched_words
            ]
    return None

def excerpt_search(page, evidence):
    words = page.get_text("words")

    if not words:
        return None

    page_words = [word[4] for word in words]
    evidence_words = normalize_text(evidence).split()

    absolute_minimum = 5
    minimum_ratio = 0.6

    minimum_chunk_size = max( absolute_minimum, math.ceil(len(evidence_words) * minimum_ratio) )

    if minimum_chunk_size >= len(evidence_words):
        return None

    comparisons = 0

    for chunk_size in range( len(evidence_words) - 1, minimum_chunk_size - 1, -1 ):
        for start in range( len(evidence_words)-chunk_size+1 ):
            chunk = evidence_words[start: start+chunk_size]
            normalized_chunk = " ".join(chunk)
            matches = []
            for i in range(len(page_words) - chunk_size + 1):
                if comparisons >= MAX_EXCERPT_COMPARISONS:
                    return None

                comparisons += 1

                candidate_words = page_words[i:i + chunk_size]
                candidate = normalize_text(" ".join(candidate_words))

                if candidate == normalized_chunk:
                    matches.append(i)

                    # This chunk is no longer unique on the page.
                    if len(matches) > 1:
                        break

            if len(matches) == 1:
                match_start = matches[0]
                matched_words = words[match_start:match_start+chunk_size]

                lines = {}
                for word in matched_words:
                    line_key = (word[5], word[6])

                    if line_key not in lines:
                        lines[line_key] = []
                    
                    lines[line_key].append(word)

                rects = []
                for line_words in lines.values():
                    x0 = min(word[0] for word in line_words)
                    y0 = min(word[1] for word in line_words)
                    x1 = max(word[2] for word in line_words)
                    y1 = max(word[3] for word in line_words)

                    rect = pymupdf.Rect(x0, y0, x1, y1)
                    rects.append(rect)

                return {
                    "rects": rects,
                    "text": " ".join(
                        word[4] for word in matched_words
                    ),
                }

    return None

async def analysis(pages):
    document_text = build_document_text(pages)

    try:
        response = await client.aio.models.generate_content(
            model=analysis_model,
            contents=document_text,
            config=types.GenerateContentConfig(
                system_instruction=analysis_prompt,
                response_mime_type="application/json",
                response_schema=Analysis,
            ),
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Document analysis timed out. Please try again."
        ) from None

    except errors.APIError as exc:
        print("Gemini API error code:", exc.code)

        if exc.code in (408, 504):
            raise HTTPException(
                status_code=504,
                detail="Document analysis timed out. Please try again."
            ) from None

        if exc.code == 429 or exc.code >= 500:
            raise HTTPException(
                status_code=503,
                detail="Document analysis is temporarily unavailable. Please try again later."
            ) from None

        raise HTTPException(
            status_code=502,
            detail="Document cannot be analyzed currently."
        ) from None

    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the analysis service. Please try again."
        ) from None

    except Exception as exc:
        print("Gemini processing error type:", type(exc).__name__)

        raise HTTPException(
            status_code=502,
            detail="Document cannot be analyzed currently."
        ) from None

    if not isinstance(response.parsed, Analysis):
        raise HTTPException(
            status_code=502,
            detail="The analysis service returned an unusable response. Please try again."
        )

    return response.parsed

def locate_evidence( pdf, page_number, evidence ):

    if page_number < 1 or page_number > len(pdf):
        return None

    page = pdf[page_number-1]
    #exact search
    rects = page.search_for(evidence)
    if rects:
        print("Matched: exact")
        return {"method": "exact", "rects": rects}

    #normalized search
    rects = normalized_search(page, evidence)
    if rects:
        print("Matched: normalized")
        return {"method": "normalized", "rects": rects}

    #longest excerpt
    excerpt = excerpt_search(page, evidence)
    if excerpt:
        print("Matched: excerpt")
        return {
            "method": "excerpt",
            "rects": excerpt["rects"],
            "matched_excerpt": excerpt["text"],
        }

    return None

def recover_evidence(pdf, claimed_page, evidence):
    if not evidence.strip():
        return None

    matches = []

    for page_index in range(len(pdf)):
        page_number = page_index + 1

        if page_number == claimed_page:
            continue

        page = pdf[page_index]

        #exact
        rects = page.search_for(evidence)

        #normalization
        if not rects:
            rects = normalized_search(page, evidence)

        if rects:
            matches.append((page_number, rects))
            # More than one possible page makes recovery ambiguous.
            if len(matches) > 1:
                return None

    return matches[0] if matches else None

def ground_evidence(pdf, claimed_page, evidence):

    if not evidence.strip():
        return {
            "status": "UNRESOLVED",
            "page": None,
            "rects": [],
            "reason": "FULL_EVIDENCE_NOT_LOCATED_UNIQUELY",
            "matched_excerpt": None,
            "matched_page": None,
        }

    match = locate_evidence(pdf, claimed_page, evidence)

    # Full evidence located on Gemini's claimed page.
    if match and match["method"] in ("exact", "normalized"):
        return {
            "status": "VERIFIED",
            "page": claimed_page,
            "rects": match["rects"],
        }

    # Even if an excerpt matched, try finding the full quote elsewhere.
    recovery = recover_evidence(pdf, claimed_page, evidence)

    if recovery:
        recovery_page, recovery_rects = recovery

        return {
            "status": "RECOVERED",
            "page": recovery_page,
            "rects": recovery_rects,
        }

    # Full recovery failed. Preserve any excerpt for manual review.
    partial_match = (
        match is not None
        and match["method"] == "excerpt"
    )

    return {
        "status": "UNRESOLVED",
        "page": None,
        "rects": [],
        "reason": (
            "PARTIAL_MATCH"
            if partial_match
            else "FULL_EVIDENCE_NOT_LOCATED_UNIQUELY"
        ),
        "matched_excerpt": (
            match["matched_excerpt"]
            if partial_match
            else None
        ),
        "matched_page": (
            claimed_page
            if partial_match
            else None
        ),
    }

def apply_highlights(pdf, highlight_items):
    colors = {
        AttentionLevel.HIGH: (1.0, 0.7, 0.7),
        AttentionLevel.REVIEW: (1.0, 1.0, 0.6),
    }

    for item in highlight_items:
        color = colors.get(item["attention_level"])

        if color is None or not item["rects"]:
            continue

        page = pdf[item["page"] - 1]
        annotation = page.add_highlight_annot(item["rects"])
        annotation.set_colors(stroke=color)
        annotation.update()

@app.get("/")
def home():
    return { "message": "ClauseCheck API"}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(file: UploadFile):
    contents = await validate_pdf(file)
    pdf, pages = extract_pdf_text(contents)

    try:
        result = await analysis(pages)

        grounded_findings = []
        unresolved_findings = []
        highlight_items = []

        for finding in result.findings:
            grounding = ground_evidence(
                pdf,
                finding.page,
                finding.evidence
            )
            if grounding["status"] == "UNRESOLVED":
                unresolved_findings.append(
                    UnresolvedFinding(
                        **finding.model_dump(),
                        grounding_status="UNRESOLVED",
                        reason=grounding["reason"],
                        matched_excerpt=grounding["matched_excerpt"],
                        matched_page=grounding["matched_page"],
                    )
                )
                continue

            grounded_finding = GroundedFinding(
                category=finding.category,
                attention_level=finding.attention_level,
                evidence=finding.evidence,
                page=grounding["page"],
                explanation=finding.explanation,
                why_it_matters=finding.why_it_matters,
                grounding_status=grounding["status"]
            )

            grounded_findings.append(grounded_finding)

            if finding.attention_level in ( AttentionLevel.HIGH, AttentionLevel.REVIEW ):
                highlight_items.append({
                    "page": grounding["page"],
                    "rects": grounding["rects"],
                    "attention_level": finding.attention_level
                })

            print("Category:", finding.category)
            print("Claimed page:", finding.page)
            print("Located page:", grounding["page"])
            print("Status:", grounding["status"])

        print("Highlight items:", len(highlight_items))
        for item in highlight_items:
            print(
                "Page:", item["page"],
                "Level:", item["attention_level"].value,
                "Rectangles:", len(item["rects"])
            )

        apply_highlights( pdf, highlight_items )

        highlighted_pdf_bytes = pdf.tobytes()
        highlighted_pdf_base64 = base64.b64encode(highlighted_pdf_bytes).decode("ascii")

        return AnalysisResponse(
            document_type=result.document_type,
            summary=result.summary,
            findings=grounded_findings,
            unresolved_findings=unresolved_findings,
            unresolved_count=len(unresolved_findings),
            highlighted_pdf_base64=highlighted_pdf_base64,
        )
    
    finally:
        pdf.close()
