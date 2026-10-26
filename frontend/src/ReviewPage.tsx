import { useEffect, useMemo, useState, useRef } from "react";

import { useTheme } from './theme';
import { downloadHighlightedPdf, type CompletedAnalysis } from './api';
import PdfViewer from './PdfViewer';
import './review.css';

type Priority = "high" | "review" | "routine";
type Finding = {
  id: string;
  category: string;
  priority: Priority;
  page: number;
  meaning: string;
  matters: string;
  quote: string;
  corrected?: boolean;
};

const priorityLabel: Record<Priority, string> = {
  high: "HIGH ATTENTION",
  review: "REVIEW",
  routine: "ROUTINE",
};

function Icon({
  name,
  size = 18,
}: {
  name: "moon" | "sun" | "arrow" | "download" | "plus" | "minus" | "fit" | "chevron" | "document";
  size?: number;
}) {
  const paths = {
    moon: <path d="M20.5 14.4A8.2 8.2 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </>
    ),
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    download: <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    fit: <path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    document: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function FindingCard({
  finding,
  expanded,
  onExpand,
  onLocate,
}: {
  finding: Finding;
  expanded: boolean;
  onExpand: () => void;
  onLocate: () => void;
}) {
  return (
    <article className={`finding-card priority-${finding.priority}`}>
      <div className="card-topline">
        <span className="category">{finding.category}</span>
        <span className={`badge ${finding.priority}`}>{priorityLabel[finding.priority]}</span>
      </div>
      <div className="finding-copy">
        <h4>What it means</h4>
        <p>{finding.meaning}</p>
      </div>
      <div className="matters">
        <h4>Why it matters</h4>
        <p>{finding.matters}</p>
      </div>
      <div className="card-actions">
        <button className="text-action" onClick={onExpand} aria-expanded={expanded}>
          View exact clause <span className={expanded ? "rotated" : ""}><Icon name="chevron" size={16} /></span>
        </button>
        <button className="text-action locate" onClick={onLocate}>
          Show in document <span aria-hidden="true">↗</span>
        </button>
      </div>
      {expanded && (
        <div className="source-block">
          <span className="source-label">Exact source quote</span>
          <blockquote>“{finding.quote}”</blockquote>
          <div className="source-meta">
            <span>Page {finding.page}</span><span className="dot" />
            <span className="located">Source located</span>
            {finding.corrected && <><span className="dot" /><span>Page corrected by ClauseCheck</span></>}
          </div>
        </div>
      )}
    </article>
  );
}

export default function ReviewPage({result, onReset}: {result: CompletedAnalysis; onReset: () => void}) {
  const [sharedTheme, toggleTheme] = useTheme();
  const theme = sharedTheme === 'dark' ? 'dusk' : 'lavender';
  const analysis = result.analysis;
  const findings: Finding[] = useMemo(() => analysis.findings.map((f, i) => ({
    id: `finding-${i}`, category: f.category,
    priority: f.attention_level === 'HIGH ATTENTION' ? 'high' : f.attention_level === 'REVIEW' ? 'review' : 'routine',
    page: f.page, meaning: f.explanation, matters: f.why_it_matters, quote: f.evidence, corrected: f.grounding_status === 'RECOVERED'
  })), [analysis]);
  const [pageCount, setPageCount] = useState(0);
  const navigationPageCount = pageCount || Math.max(
    1,
    ...findings.map(finding => finding.page),
    ...analysis.unresolved_findings.map(item => item.matched_page ?? 1),
  );
  const [downloadError, setDownloadError] = useState('');
  const [location, setLocation] = useState<{evidence: string; key: number; page: number} | null>(null);
  const findingsScroll = useRef<HTMLDivElement>(null);
  const count = (priority: Priority) => findings.filter(f => f.priority === priority).length;
  const selectPriority = (priority: Priority) => {
    setMobileTab("findings"); setFilter(priority); setPage(findings.find(f => f.priority === priority)?.page || 1);
    document.getElementById('review-workspace')?.scrollIntoView({block: 'start'});
  };
  const download = () => { try { downloadHighlightedPdf(result); setDownloadError(''); } catch(e) { setDownloadError((e as Error).message); } };
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Priority | "all">("all");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"findings" | "document">("findings");
  const [fit, setFit] = useState<"page" | "width">("page");
  const [zoom, setZoom] = useState(100);


  useEffect(() => { if (findingsScroll.current) findingsScroll.current.scrollTop = 0; }, [page, filter]);

  const pageFindings = useMemo(
    () => findings.filter((item) => item.page === page && (filter === "all" || item.priority === filter)),
    [page, filter, findings],
  );

  const locate = (finding: Finding) => {
    setPage(finding.page);
    setLocation({evidence: finding.quote, key: Date.now(), page: finding.page});
    setMobileTab("document");

  };

  return (
    <div className="review-page app-shell" data-theme={theme}>
      <header className="navbar">
        <div className="navbar-inner">
          <a className="brand" href="#top" aria-label="ClauseCheck home">
            <svg className="brand-logo" width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M9 3h16l8 8v24a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--surface-strong)" stroke="var(--ink)" strokeWidth="2.4"/>
              <rect x="11" y="15" width="16" height="5" rx="2" fill="var(--yellow-soft)"/>
              <rect x="11" y="23" width="9" height="3" rx="1.5" fill="var(--line)"/>
              <circle cx="27" cy="29" r="7" fill="var(--purple)"/>
              <path d="M23.5 29l2.6 2.6 4.6-5" fill="none" stroke="var(--button-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>ClauseCheck</span>
          </a>
          <div className="nav-actions">
            <button className="review-another" onClick={onReset}>Review another document <Icon name="arrow" /></button>
            <div className="theme-wrap">
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                role="switch"
                aria-checked={theme === "dusk"}
                aria-label={`Switch to ${theme === "lavender" ? "Dusk" : "Lavender"} theme`}
              >
                <span className="theme-track" />
                <span className="theme-thumb">{theme === "lavender" ? <Icon name="sun" size={21} /> : <Icon name="moon" size={21} />}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="intro container">
          <div className="steps" aria-label="Review progress">
            <span className="complete" aria-label="Upload completed"><i aria-hidden="true">✓</i> Upload</span><b />
            <span className="active" aria-current="step"><i>2</i> Review</span><b />
            <span><i>3</i> Download</span>
          </div>
          
          <h1>Agreement review</h1>
          <p className="doc-type">{analysis.document_type}</p>
        </section>

        <section className="summary container">
          <div className="section-heading">
            <div>
              <span className="section-number">01</span>
              <h2>Summary of your document</h2>
            </div>
            <span className="filename" title={result.filename}>{result.filename}</span>
          </div>
          <div className="summary-copy">
            <p>{summaryOpen || analysis.summary.length <= 280 ? analysis.summary : analysis.summary.slice(0, 280).replace(/\s+\S*$/, '') + '…'}</p>
            {analysis.summary.length > 280 && <button className="read-more" aria-expanded={summaryOpen} onClick={() => setSummaryOpen(!summaryOpen)}>
              {summaryOpen ? 'Read less' : 'Read more'} <Icon name="chevron" size={15} />
            </button>}
          </div>
        </section>

        <section className="overview container">
          <div className="overview-title">
            <p className="eyebrow">Across the whole document</p>
            <h2>Document overview</h2>
          </div>
          <div className="overview-grid">
            <button className="stat high" onClick={() => selectPriority("high")}>
              <span className="stat-number">{count("high")}</span><span><strong>High attention</strong><small>Read carefully</small></span>
            </button>
            <button className="stat review" onClick={() => selectPriority("review")}>
              <span className="stat-number">{count("review")}</span><span><strong>Review</strong><small>Worth a closer look</small></span>
            </button>
            <button className="stat routine" onClick={() => selectPriority("routine")}>
              <span className="stat-number">{count("routine")}</span><span><strong>Routine</strong><small>No special attention indicated</small></span>
            </button>
            <button className="stat manual" onClick={() => { setManualOpen(true); setTimeout(() => document.querySelector("#manual")?.scrollIntoView({ behavior: "smooth" }), 10); }}>
              <span className="stat-number">{analysis.unresolved_count}</span><span><strong>Needs manual checking</strong><small>Source not fully verified</small></span><Icon name="arrow" />
            </button>
          </div>
          <p className="priority-note">Attention levels help you prioritise reading. They are not legal judgments.</p>
        </section>

        <section id="review-workspace" className="workspace-section container">
          <div className="workspace-heading">
            <div><span className="section-number">02</span><h2>Review page by page</h2></div>
            <p>Located source text does not guarantee a correct AI interpretation.</p>
          </div>

          <div className="mobile-tabs" role="tablist">
            <button role="tab" aria-selected={mobileTab === "findings"} className={mobileTab === "findings" ? "active" : ""} onClick={() => setMobileTab("findings")}>Findings <span>{findings.filter(f => f.page === page).length}</span></button>
            <button role="tab" aria-selected={mobileTab === "document"} className={mobileTab === "document" ? "active" : ""} onClick={() => setMobileTab("document")}>Document <span>Page {page}</span></button>
          </div>

          <div className="workspace">
            <div className={`panel findings-panel ${mobileTab === "findings" ? "mobile-active" : ""}`}>
              <div className="panel-header">
                <div><p className="panel-kicker">Page {page}</p><h3>Findings</h3></div>
                <span className="result-count">{pageFindings.length} {pageFindings.length === 1 ? "finding" : "findings"}</span>
              </div>
              <div className="filters" aria-label="Filter findings">
                {(["all", "high", "review", "routine"] as const).map((value) => (
                  <button key={value} aria-pressed={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                    {value === "all" ? "All" : priorityLabel[value]}
                  </button>
                ))}
              </div>
              <div className="findings-scroll" ref={findingsScroll}>
                {pageFindings.length ? pageFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    expanded={expanded.includes(finding.id)}
                    onExpand={() => setExpanded((items) => items.includes(finding.id) ? items.filter(id => id !== finding.id) : [...items, finding.id])}
                    onLocate={() => locate(finding)}
                  />
                )) : (
                  <div className="empty-state">
                    <span className="empty-icon"><Icon name="document" size={24} /></span>
                    <h3>{filter === "all" ? "No findings were returned for this page" : `No ${filter === "high" ? "high-attention" : priorityLabel[filter as Priority].toLowerCase()} findings on this page`}</h3>
                    <p>{filter === "all" ? "This does not guarantee that the page is free from important terms." : "Try another attention level or return to all findings."}</p>
                    {filter !== "all" && <button className="secondary-button" onClick={() => setFilter("all")}>Show all findings</button>}
                  </div>
                )}
              </div>
            </div>

            <div className={`panel document-panel ${mobileTab === "document" ? "mobile-active" : ""}`}>
              <div className="document-toolbar">
                <div><p className="panel-kicker">Annotated document</p><h3>Page {page}{pageCount > 0 ? ` of ${pageCount}` : ""}</h3></div>
                <div className="viewer-controls">
                  <button aria-label="Zoom out" onClick={() => setZoom(Math.max(50, zoom - 25))}><Icon name="minus" /></button>
                  <span>{zoom}%</span>
                  <button aria-label="Zoom in" onClick={() => setZoom(Math.min(250, zoom + 25))}><Icon name="plus" /></button>
                  <div className="control-divider" />
                  <button className={fit === "page" ? "selected" : ""} onClick={() => { setFit("page"); setZoom(100); }}><Icon name="fit" /> Fit page</button>
                  <button className={fit === "width" ? "selected" : ""} onClick={() => { setFit("width"); setZoom(100); }}>Fit width</button>
                </div>
              </div>
              <PdfViewer base64={analysis.highlighted_pdf_base64} pageNumber={page} fit={fit} zoom={zoom}
                location={location} onLoaded={setPageCount} />
            </div>
          </div>

          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>← <span>Previous page</span></button>
            <div className="page-buttons">
                {Array.from(
                { length: navigationPageCount },
                (_, i) => i + 1
              )
                .filter(n =>
                  navigationPageCount <= 9 ||
                  n === 1 ||
                  n === navigationPageCount ||
                  Math.abs(n - page) <= 2
                )
                .map(n => (
                  <button
                    key={n}
                    className={page === n ? "active" : ""}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
            </div>
            <button
              disabled={page >= navigationPageCount}
              onClick={() => setPage(page + 1)}
            >
              <span>Next page</span> →
            </button>
          </div>
        </section>

        <section id="manual" className={`manual-section container ${manualOpen ? "open" : ""}`}>
          <button className="manual-disclosure" onClick={() => setManualOpen(!manualOpen)} aria-expanded={manualOpen}>
            <span className="manual-icon">?</span><span><small>Separate from attention priorities</small><strong>Needs manual checking</strong></span>
            <span className="manual-count">{analysis.unresolved_count} {analysis.unresolved_count === 1 ? 'item' : 'items'}</span>
            <Icon name="chevron" />
          </button>
          {manualOpen && <div className="manual-content">
            {!analysis.unresolved_count && (
              <p>
                No unverified findings were returned. This does not mean
                every important clause was identified.
              </p>
            )}
            {analysis.unresolved_findings.map((item, i) => <article className="manual-card" key={i}>
              <div className="manual-card-heading"><div><span className="category">{item.category}</span><span className="manual-badge">Needs manual checking</span></div>
                <p>{item.reason === 'PARTIAL_MATCH' ? 'Only part of the source wording was found.' : 'The full source wording could not be located uniquely.'}</p></div>
              <details className="manual-details"><summary className="secondary-button">Inspect details</summary>
                <div className="unverified">
                  <div><span>AI-provided quote · unverified</span><blockquote>{item.evidence}</blockquote></div>
                  <div><span>AI explanation · unverified</span><p>{item.explanation}</p><span>Why it matters · unverified</span><p>{item.why_it_matters}</p></div>
                  <p className="unverified-note">Suggested page {item.page} · unverified. This item is not highlighted.</p>
                  {item.matched_excerpt && <div><span>Located excerpt{item.matched_page ? ` · page ${item.matched_page}` : ''}</span><blockquote>{item.matched_excerpt}</blockquote></div>}
                  {item.matched_page && <button className="secondary-button" onClick={() => {
                    setPage(item.matched_page!); setMobileTab('document'); setLocation(item.matched_excerpt ? {evidence: item.matched_excerpt, key: Date.now(), page: item.matched_page!} : null);
                    document.getElementById('review-workspace')?.scrollIntoView({block: 'start'});
                  }}>View matched page {item.matched_page}</button>}
                </div>
              </details>
            </article>)}
          </div>}
        </section>

        <section className="download-section container">
          <div className="download-icon"><Icon name="download" size={26} /></div>
          <div><span className="section-number">03</span><h2>Keep your highlighted copy</h2><p>Download your annotated agreement. HIGH ATTENTION is light red; REVIEW is light yellow. Manual-checking items are not highlighted.</p></div>
          <button className="primary-button" onClick={download}><Icon name="download" /> Download highlighted PDF</button>
        </section>

        {downloadError && <p role="alert" className="container">{downloadError}</p>}
        <footer className="footer-warning container">
          <p>ClauseCheck would not present itself as a lawyer, legal advisor, or replacement for professional legal review.</p>
        </footer>
      </main>
    </div>
  );
}
