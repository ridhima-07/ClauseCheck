import { useEffect, useRef, useState } from 'react';
import './upload.css';
import { analyzeDocument, downloadHighlightedPdf, type CompletedAnalysis } from './api';
import { ThemeSwitch, useTheme } from './theme';

const MAX_SIZE = 10 * 1024 * 1024;
const formatSize = (size: number) => size < 1048576 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1048576).toFixed(1)} MB`;
function Logo() {
  return <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><path d="M9 3h16l8 8v24a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--card)" stroke="var(--ink)" strokeWidth="2.4"/><rect x="11" y="15" width="16" height="5" rx="2" fill="var(--rv)"/><rect x="11" y="23" width="9" height="3" rx="1.5" fill="var(--line)"/><circle cx="27" cy="29" r="7" fill="var(--acc)"/><path d="M23.5 29l2.6 2.6 4.6-5" fill="none" stroke="var(--acc-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
type Props = {
  result: CompletedAnalysis | null;
  onStart: () => void;
  onComplete: (result: CompletedAnalysis) => void;
  onReset: () => void;
};
export default function UploadPage({ result, onStart, onComplete, onReset }: Props) {
  const [theme, toggleTheme] = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  const input = useRef<HTMLInputElement>(null);
  const choose = useRef<HTMLButtonElement>(null);
  const depth = useRef(0);
  function pick(files: FileList | null) {
    setDrag(false); depth.current = 0;
    if (loading || !files?.length) return;
    let message = '';
    const next = files[0];
    if (files.length > 1) message = 'Choose one PDF at a time.';
    else if (!/\.pdf$/i.test(next.name) || (next.type && next.type !== 'application/pdf')) message = 'That file isn’t a PDF. Choose a PDF file.';
    else if (next.size === 0) message = 'That file is empty. Choose a different PDF.';
    else if (next.size > MAX_SIZE) message = 'That file is over the 10 MB limit. Choose a smaller PDF.';
    setError(message); setSelectionError(!!message);
    if (!message) { setSubmitted(false); setFile(next); setStatus(`Selected ${next.name}, ${formatSize(next.size)}.`); }
  }
  async function submit() {
    if (!file || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);
    onStart(); setLoading(true); setSubmitted(true); setError(''); setSelectionError(false);
    setStatus('Analyzing your agreement. Please keep this page open.');
    try {
      const analysis = await analyzeDocument(file, controller.signal);
      if (!controller.signal.aborted) onComplete({ filename: file.name, analysis });
    } catch (error) {
      if (!controller.signal.aborted || timedOut) {
        setError(timedOut ? 'The request took too long. Processing may still be finishing on the server. Please wait a moment before trying again.' : error instanceof Error ? error.message : 'Analysis failed. Please try again.');
        setStatus('Analysis did not complete. You can try again.');
      }
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }
  function download() {
    if (!result) return;
    try { downloadHighlightedPdf(result); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Download failed.'); }
  }
  const extension = file?.name.match(/\.[^.]+$/)?.[0] || '';
  return <div className="landing-page upload-page" data-theme={theme}>
    <header><div className="w nav"><a className="brand" href="#top"><Logo/>ClauseCheck</a><a className="u-home" href="#top">← Back to home</a></div><ThemeSwitch theme={theme} toggleTheme={toggleTheme}/></header>
    <main className="u-main">
      <ol className="u-journey" aria-label="Review journey"><li aria-current={!result ? 'step' : undefined}><b>1</b> Upload</li><li aria-current={result ? 'step' : undefined}><b>2</b> Review</li><li><b>3</b> Download</li></ol>
      <h1>{result ? 'Your analysis is ready' : 'Upload your agreement'}</h1>
      <p className="u-lead">{result ? 'Your PDF was processed successfully. You can download your highlighted copy below.' : 'Choose a text-based PDF to explore its clauses and what deserves your attention.'}</p>
      {result ? <div className="u-card u-success" role="region" aria-label="Analysis received">
        <p className="u-result-file">{result.filename}</p>
        <h2>{result.analysis.document_type}</h2>
        <p className="u-result-summary">{result.analysis.summary}</p>
        <p><strong>{result.analysis.findings.length}</strong> findings with located evidence · <strong>{result.analysis.unresolved_count}</strong> unverified findings</p>
        <p className="u-result-note">Unverified findings require manual checking. Detailed finding review is not yet available on this screen. Located evidence does not guarantee a correct interpretation.</p>
        <button className="btn u-analyze" onClick={download}>Download highlighted PDF ↓</button>
        <button className="btn g u-analyze" onClick={onReset}>Upload another agreement</button>
        <p className="u-result-note">Results are kept only for this session and are cleared when you refresh.</p>
        {error && <p className="u-error" role="alert">{error}</p>}
      </div> : <>
      <div className="u-card">
        <input ref={input} type="file" accept="application/pdf,.pdf" hidden disabled={loading} onChange={e => { pick(e.target.files); e.target.value = ''; }}/>
        <div className={`u-zone${drag ? ' dragging' : ''}${file ? ' selected' : ''}`} onDragEnter={e => { e.preventDefault(); if (!loading) { depth.current++; setDrag(true); } }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = loading ? 'none' : 'copy'; }} onDragLeave={e => { e.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDrag(false); }} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files); }}>
          {file ? <><div className="u-file"><div className="u-file-icon" aria-hidden="true">PDF</div><div className="u-meta"><div className="u-filename" title={file.name} tabIndex={0} aria-label={file.name}><span>{file.name.slice(0, file.name.length - extension.length)}</span><span>{extension}</span></div><p>{formatSize(file.size)} · Selected on your device</p></div></div><div className="u-file-actions"><button className="btn g" ref={choose} disabled={loading} onClick={() => input.current?.click()}>Replace</button><button className="btn g" disabled={loading} onClick={() => { setFile(null); setError(''); setSubmitted(false); setStatus('File removed.'); requestAnimationFrame(() => choose.current?.focus()); }}>Remove</button></div><p className="u-selection-note">{loading ? 'Your selection stays here while processing.' : submitted ? 'Your file remains selected. You can retry or choose another PDF.' : 'Your file is selected. Nothing has been uploaded.'}</p></> : <><div className="u-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></div><h2>Drop your PDF here</h2><p className="u-or">or</p><button className="btn" ref={choose} onClick={() => input.current?.click()}>Choose PDF</button></>}
        </div>
        {error && <p className="u-error" role="alert">ⓘ {error}{file && selectionError && ' Your previous selection is unchanged.'}</p>}
        <div className="u-requirements"><p>One PDF · Up to 10 MB · Up to 50 pages</p><p>Selectable text required. Scanned and password-protected PDFs aren’t supported.</p></div>
        <p className="u-privacy"><span aria-hidden="true">i</span>Document text is sent to an AI provider for analysis.</p>
        <button className="btn u-analyze" disabled={!file || loading} onClick={submit}>{loading ? <><span className="u-spinner" aria-hidden="true"/>Analyzing your agreement…</> : 'Analyze agreement →'}</button>
        <p className="u-demo-note">{loading ? 'Please keep this page open. This may take a little while.' : 'Review the findings before relying on the analysis.'}</p>
      </div>
      <div className="u-sr" role="status">{status}</div>
      </>}
    </main>
    <footer><div className="w"><div className="fr"><a className="brand" href="#top"><Logo/>ClauseCheck</a><span>AI-powered document review for agreements.</span></div><p className="warn" role="note">ClauseCheck would not present itself as a lawyer, legal advisor, or replacement for professional legal review.</p></div></footer>
  </div>;
}
