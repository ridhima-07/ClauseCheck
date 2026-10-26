import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, Util, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;
type Props = {base64: string; pageNumber: number; fit: 'page' | 'width'; zoom: number;
  location: {evidence: string; key: number; page: number} | null; onLoaded: (count: number) => void};
type Box = {left: number; top: number; width: number; height: number};
const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export default function PdfViewer({base64, pageNumber, fit, zoom, location, onLoaded}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [size, setSize] = useState({width: 400, height: 600});
  const [sheet, setSheet] = useState({width: 1, height: 1});
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setPdf(null); onLoaded(0);
    let task: ReturnType<typeof getDocument> | undefined;
    try {
      const binary = atob(base64);
      task = getDocument({data: Uint8Array.from(binary, c => c.charCodeAt(0)), isEvalSupported: false});
      task.promise.then(doc => { if (active) {setPdf(doc); onLoaded(doc.numPages);} })
        .catch(() => {if (active) {setError('The PDF preview could not be opened. You can still try downloading the highlighted PDF.'); setBusy(false);}});
    } catch { setError('The PDF preview could not be opened.'); setBusy(false); }
    return () => {active = false; void task?.destroy();};
  }, [base64, onLoaded]);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const observer = new ResizeObserver(() => {if (el.clientWidth && el.clientHeight) setSize({width: el.clientWidth, height: el.clientHeight});});
    observer.observe(el); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setBusy(true); setBoxes([]); setNotice(''); setError('');
    const run = async () => {
      const page = await pdf.getPage(pageNumber);
      if (!active || !canvas.current) return;
      const original = page.getViewport({scale: 1});
      const scale = Math.max(.1, Math.min((size.width - 36) / original.width, fit === 'page' ? (size.height - 36) / original.height : Infinity)) * zoom / 100;
      const viewport = page.getViewport({scale});
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const target = canvas.current;
      target.width = Math.ceil(viewport.width * ratio); target.height = Math.ceil(viewport.height * ratio);
      target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
      setSheet({width: viewport.width, height: viewport.height});
      renderTask = page.render({canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0]});
      await renderTask.promise;
      if (!active) return;
      setBusy(false);
      if (stage.current) {stage.current.scrollTop = 0; stage.current.scrollLeft = 0;}
      if (!location || location.page !== pageNumber) return;
      const text = await page.getTextContent();
      if (!active) return;
      const items = text.items.filter((item): item is Extract<typeof item, {str: string}> => 'str' in item);
      let all = ''; const spans = items.map(item => {const start = all.length; all += normalize(item.str); return {item, start, end: all.length};});
      const needle = normalize(location.evidence); const index = needle ? all.indexOf(needle) : -1;
      if (index < 0 || all.indexOf(needle, index + 1) >= 0) {
        setNotice('Relevant page opened. The exact clause could not be uniquely focused in this viewer; use the source quote to compare.'); return;
      }
      const found = spans.filter(s => s.end > index && s.start < index + needle.length).map(({item}) => {
        const tx = Util.transform(viewport.transform, item.transform);
        const height = Math.hypot(tx[2], tx[3]);
        return {left: tx[4], top: tx[5] - height, width: Math.max(2, item.width * scale), height: height * 1.25};
      });
      setBoxes(found);
      if (found[0] && stage.current) stage.current.scrollTop = Math.max(0, found[0].top - stage.current.clientHeight / 3);
      timer = setTimeout(() => {if (active) setBoxes([]);}, 3000);
    };
    run().catch(e => {if (active && e?.name !== 'RenderingCancelledException') {setError('This page could not be displayed. Try another page or download the PDF.'); setBusy(false);}});
    return () => {active = false; renderTask?.cancel(); if(timer) clearTimeout(timer);};
  }, [pdf, pageNumber, fit, zoom, size, location]);
  return <div ref={stage} className="pdf-stage" tabIndex={0} role="region" aria-label={`Annotated PDF page ${pageNumber}`}>
    {busy && <p className="pdf-status" role="status">Loading document page…</p>}
    {error && <p className="pdf-status" role="alert">{error}</p>}
    {notice && <p className="pdf-status" role="status">{notice}</p>}
    <div className="pdf-sheet" style={{...sheet, visibility: busy || error ? 'hidden' : 'visible'}}>
      <canvas ref={canvas} role="img" aria-label={`Original document page ${pageNumber}, with backend annotations`} />
      {boxes.map((box,i) => <div key={i} className="pdf-focus" style={box} />)}
    </div>
  </div>;
}
