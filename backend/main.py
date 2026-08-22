from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import Analysis
import pymupdf

app = FastAPI(title="ClauseCheck API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def validate_pdf( file ):
    MAX_FILE_SIZE = ( 10 * 1024 * 1024 )
    if ( file.content_type != "application/pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    contents = await file.read(MAX_FILE_SIZE +1)
    if (len(contents) > MAX_FILE_SIZE):
        raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit")
    
    return contents 

def extract_pdf_text( contents ):
    pdf = pymupdf.open( stream=contents, filetype="pdf")
    no_of_pages = len(pdf)

    pages = []
    for page_number, page in enumerate(pdf):
        pages.append( {"page_number": page_number+1, "text" : page.get_text()} )

    return pages

def analysis( pages ):


@app.get("/")
def home():
    return { "message": "ClauseCheck API"}

@app.get("/hello")
def hello():
    return {"message": "Hello World"}

@app.post("/analyze", response_model = Analysis )
async def analyze(file: UploadFile ):
    contents = await validate_pdf(file)
    pages = extract_pdf_text(contents)
    # return {
    #     "file": file.filename,
    #     "content_type": file.content_type,
    #     "size": file.size,
    #     "no_of_pages": no_of_pages,
    #     "pages": pages
    # }
    return pages


