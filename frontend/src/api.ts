/** The wire contract in backend/schemas.py. No document data is persisted. */
export type AttentionLevel = 'HIGH ATTENTION' | 'REVIEW' | 'ROUTINE';
export interface Finding {
  category: string;
  attention_level: AttentionLevel;
  evidence: string;
  page: number;
  explanation: string;
  why_it_matters: string;
}
export interface GroundedFinding extends Finding { grounding_status: 'VERIFIED' | 'RECOVERED' }
export interface UnresolvedFinding extends Finding {
  grounding_status: 'UNRESOLVED';
  reason: 'PARTIAL_MATCH' | 'FULL_EVIDENCE_NOT_LOCATED_UNIQUELY';
  matched_excerpt: string | null;
  matched_page: number | null;
}
export interface AnalysisResponse {
  document_type: string;
  summary: string;
  findings: GroundedFinding[];
  unresolved_findings: UnresolvedFinding[];
  unresolved_count: number;
  highlighted_pdf_base64: string;
}
export interface CompletedAnalysis { filename: string; analysis: AnalysisResponse }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const pageNumber = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1;
function isFinding(value: unknown): value is Finding {
  return record(value) && ['category', 'evidence', 'explanation', 'why_it_matters'].every(key => typeof value[key] === 'string')
    && typeof value.evidence === 'string' && !!value.evidence.trim()
    && ['HIGH ATTENTION', 'REVIEW', 'ROUTINE'].includes(String(value.attention_level)) && pageNumber(value.page);
}
export function parseAnalysis(value: unknown): AnalysisResponse {
  if (!record(value) || typeof value.document_type !== 'string' || typeof value.summary !== 'string'
      || !Array.isArray(value.findings) || !value.findings.every(item => isFinding(item) && record(item) && ['VERIFIED','RECOVERED'].includes(String(item.grounding_status)))
      || !Array.isArray(value.unresolved_findings) || !value.unresolved_findings.every(item => isFinding(item) && record(item)
        && item.grounding_status === 'UNRESOLVED' && ['PARTIAL_MATCH','FULL_EVIDENCE_NOT_LOCATED_UNIQUELY'].includes(String(item.reason))
        && (item.matched_excerpt === null || typeof item.matched_excerpt === 'string') && (item.matched_page === null || pageNumber(item.matched_page)))
      || !Number.isInteger(value.unresolved_count) || value.unresolved_count !== value.unresolved_findings.length
      || typeof value.highlighted_pdf_base64 !== 'string' || !value.highlighted_pdf_base64.trim()) {
    throw new Error('The backend returned an unexpected response. Please try again.');
  }
  return value as unknown as AnalysisResponse;
}

export async function analyzeDocument(file: File, signal: AbortSignal): Promise<AnalysisResponse> {
  const url = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
  const body = new FormData();
  // Some browsers omit MIME metadata. Set the part type; FastAPI still validates the bytes.
  body.append('file', file.type ? file : new File([file], file.name, { type: 'application/pdf' }), file.name);
  let response: Response;
  try {
    // Let the browser set multipart Content-Type and its boundary.
    response = await fetch(`${url}/analyze`, { method: 'POST', body, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Could not reach ClauseCheck. Check your connection and that the backend is running, then try again.');
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error(response.ok ? 'The backend returned an unreadable response. Please try again.' : `The request failed (${response.status}). Please try again.`); }
  if (!response.ok) {
    const detail = record(payload) && typeof payload.detail === 'string' ? payload.detail : null;
    throw new Error(detail || (response.status === 422 ? 'The upload request was not accepted. Please select your PDF again.' : `The request failed (${response.status}). Please try again.`));
  }
  return parseAnalysis(payload);
}

export function downloadHighlightedPdf(result: CompletedAnalysis) {
  try {
    const binary = atob(result.analysis.highlighted_pdf_base64);
    if (!binary.startsWith('%PDF-')) throw new Error('Not a PDF');
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.filename.replace(/\.pdf$/i, '')}-highlighted.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch { throw new Error('The highlighted PDF could not be downloaded. Please analyze the document again.'); }
}
