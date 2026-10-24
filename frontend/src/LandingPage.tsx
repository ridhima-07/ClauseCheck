import { ThemeSwitch, useTheme } from './theme';
import { useEffect, useRef, useState } from 'react';
import './landing.css';

// The optional callback is the integration point for the future upload screen.
type LandingPageProps = { onReviewDocument?: () => void };

export default function LandingPage({ onReviewDocument }: LandingPageProps) {
  const [theme, toggleTheme] = useTheme();
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const reviewDocument = () => {
    closeMenu();
    if (onReviewDocument) onReviewDocument();
    else setToastOpen(true);
  };

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); setToastOpen(false); }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    let revealObserver: IntersectionObserver | undefined;
    let sectionObserver: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            revealObserver?.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      element.querySelectorAll('.rev').forEach(node => revealObserver?.observe(node));
      const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('#nl a'));
      sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) links.forEach(link => {
            link.classList.toggle('on', link.getAttribute('href') === `#${entry.target.id}`);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      links.forEach(link => {
        const section = element.querySelector(link.getAttribute('href')!);
        if (section) sectionObserver?.observe(section);
      });
    } else {
      element.querySelectorAll('.rev').forEach(node => node.classList.add('in'));
    }
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      revealObserver?.disconnect();
      sectionObserver?.disconnect();
    };
  }, []);

  return (
    <div className="landing-page js" data-theme={theme} ref={root}>

<svg width="0" height="0" style={{position: "absolute"}}><symbol id="lg" viewBox="0 0 40 40"><path d="M9 3h16l8 8v24a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--card)" stroke="var(--ink)" strokeWidth="2.4"/><rect x="11" y="15" width="16" height="5" rx="2" fill="var(--rv)"/><rect x="11" y="23" width="9" height="3" rx="1.5" fill="var(--line)"/><circle cx="27" cy="29" r="7" fill="var(--acc)"/><path d="M23.5 29l2.6 2.6 4.6-5" fill="none" stroke="var(--acc-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></symbol></svg>

<header id="hd" className={scrolled ? "sc" : ""}><div className="w nav">
 <a className="brand" href="#top" aria-label="ClauseCheck home"><svg width="34" height="34" aria-hidden="true"><use href="#lg"/></svg>ClauseCheck</a>
 <button className="bg" id="bg" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} aria-controls="nl">{menuOpen ? "×" : "☰"}</button>
 <nav className={`nl${menuOpen ? " o" : ""}`} id="nl" aria-label="Main">
  <a href="#example" onClick={closeMenu}>Example</a><a href="#how" onClick={closeMenu}>How it works</a><a href="#levels" onClick={closeMenu}>Attention levels</a><a href="#documents" onClick={closeMenu}>Documents</a><a href="#evidence" onClick={closeMenu}>Evidence &amp; privacy</a>
  <button className="btn" data-r onClick={reviewDocument}>Review a document</button>
 </nav>
</div>
 <ThemeSwitch theme={theme} toggleTheme={toggleTheme}/>
</header>

<main id="top">
<section className="hero"><div className="w">
 <h1 className="rev">AI-powered document review that highlights what deserves your attention before you sign.</h1>
 <p className="lead rev">Upload an agreement, explore findings with their source clauses and plain-language explanations, and download a highlighted PDF.</p>
 <div className="row rev"><button className="btn" data-r onClick={reviewDocument}>Review a document →</button><a className="btn g" href="#example">See an example</a></div>
 <div className="scene rev" aria-label="Illustrative preview of the review experience">
  <div className="st"><span className="tag ro">1 · UPLOAD</span><b>Choose your agreement</b><p>A PDF with selectable text.</p></div>
  <div className="sheet"><div className="k"><span>Rental agreement</span><span>Illustrative</span></div>
   <p>4.2 Rent is due on the first of each month.</p><div className="ln" style={{width: "88%"}}></div>
   <p><mark>The tenant must provide written notice at least 60 days before the intended move-out date.</mark></p>
   <div className="ln" style={{width: "94%"}}></div><div className="ln" style={{width: "58%"}}></div></div>
  <div className="st"><span className="tag rv">REVIEW</span><b>Notice period</b><p>Notify the landlord in writing 60 days before you leave.</p></div>
 </div>
 <div className="pill rev"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 7 8 10.5 11.5 7M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Then download a highlighted copy</div>
</div></section>

<section id="example"><div className="w">
 <p className="eyebrow rev">Example finding</p><h2 className="rev">Every finding, beside its source</h2>
 <p className="sub rev">Here is what you will see for each clause that deserves a look: the original wording, kept apart from the explanation.</p>
 <div className="body rev"><div className="f">
  <div className="fh"><div style={{display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap"}}><span className="chip">Notice period</span><span className="tag rv">REVIEW</span></div><span className="note" style={{margin: "0"}}>Illustrative example · fictional</span></div>
  <div className="fb">
   <div className="lab">Source clause · original wording</div>
   <p className={`q${highlighted ? " hl" : ""}`} id="q">“The tenant must provide written notice at least 60 days before the intended move-out date.”</p>
   <div className="cols">
    <div><div className="lab">In plain language</div><p>You need to notify the landlord in writing at least 60 days before you plan to leave.</p></div>
    <div><div className="lab">Why it matters</div><p>This affects when you need to plan and communicate your move. Check that the notice period fits your expected timeline.</p></div>
   </div>
   <div className="ft"><span>See how this clause would look in your downloaded PDF.</span><button className="sw" id="sw" aria-pressed={highlighted} onClick={() => setHighlighted(!highlighted)}>{highlighted ? "Hide highlight" : "Show highlight"}</button></div>
  </div>
 </div></div>
</div></section>

<section id="how"><div className="w">
 <p className="eyebrow rev">How it works</p><h2 className="rev">Three steps to a highlighted copy</h2>
 <div className="g3 body">
  <div className="card rev"><div className="num">1</div><h3>Upload your agreement</h3><p>Choose a PDF with selectable text.</p></div>
  <div className="card rev"><div className="num">2</div><h3>Review the findings</h3><p>Explore relevant clauses, their explanations, and the source wording.</p></div>
  <div className="card rev"><div className="num">3</div><h3>Download your highlighted PDF</h3><p>Keep an annotated copy for reference.</p></div>
 </div>
</div></section>

<section id="levels"><div className="w">
 <p className="eyebrow rev">Attention levels</p><h2 className="rev">Review priorities, not legal judgments</h2>
 <p className="sub rev">Levels suggest where to look more closely. They say nothing about whether a clause is fair, standard or enforceable.</p>
 <div className="g3 body">
  <div className="card top hi rev"><span className="tag hi">HIGH ATTENTION</span><h3>Examine before agreeing</h3><p>Deserves specific examination before agreeing.</p><div className="sws hi">Highlighted in light red</div></div>
  <div className="card top rv rev"><span className="tag rv">REVIEW</span><h3>Understand or verify</h3><p>Important to understand or verify.</p><div className="sws rv">Highlighted in light yellow</div></div>
  <div className="card top ro rev"><span className="tag ro">ROUTINE</span><h3>No special attention</h3><p>No special attention needed based on document context.</p><div className="sws ro">Not highlighted</div></div>
 </div>
</div></section>

<section id="documents"><div className="w">
 <p className="eyebrow rev">Supported documents</p><h2 className="rev">Everyday agreements, as text-based PDFs</h2>
 <div className="two body">
  <div className="card rev"><div className="lab">Examples include</div>
   <div className="chips"><span>Employment agreements</span><span>Internship agreements</span><span>Freelance contracts</span><span>Rental agreements</span><span>NDAs</span><span>Service agreements</span></div></div>
  <div className="card rev"><div className="lab">File requirements</div>
   <div className="ok"><span className="ic">✓</span><p><b>Text-based PDFs</b> with selectable text are accepted.</p></div>
   <div className="no"><span className="ic">✕</span><p><b>Scanned or image-only PDFs</b> are not supported.</p></div></div>
 </div>
</div></section>

<section id="evidence"><div className="w">
 <p className="eyebrow rev">Evidence and limitations</p><h2 className="rev">Know what a finding does and doesn’t tell you</h2>
 <div className="g3 body">
  <div className="card rev"><div className="num">1</div><h3>Quotes are checked</h3><p>Quoted evidence is checked against the original document.</p></div>
  <div className="card rev"><div className="num">2</div><h3>Unverified findings stand apart</h3><p>Findings whose evidence cannot be verified are shown separately for manual checking.</p></div>
  <div className="card rev"><div className="num">3</div><h3>No guarantees</h3><p>Finding a quote does not guarantee a correct interpretation, or that every important issue has been identified.</p></div>
 </div>
 <div className="priv rev"><span className="ic">i</span><div><h3>Privacy and processing</h3><p>Document text is sent to an AI provider for analysis. Keep this in mind when choosing which documents to upload.</p></div></div>
</div></section>

<section style={{paddingTop: "0"}}><div className="w"><div className="close rev">
 <h2>Ready to see what stands out?</h2>
 <p>Upload a text-based PDF to get findings, source wording and a highlighted copy.</p>
 <button className="btn" data-r onClick={reviewDocument}>Review a document →</button>
</div></div></section>
</main>

<footer><div className="w">
 <div className="fr"><a className="brand" href="#top"><svg width="28" height="28" aria-hidden="true"><use href="#lg"/></svg>ClauseCheck</a><span>AI-powered document review for agreements.</span></div>
 <p className="warn" role="note">ClauseCheck would not present itself as a lawyer, legal advisor, or replacement for professional legal review.</p>
</div></footer>

<div id="toast" className={toastOpen ? "s" : ""} role="status" aria-hidden={!toastOpen}><div><b>Preview only.</b> The upload screen isn’t built yet. This button will open it; nothing is uploaded or analysed.</div><button aria-label="Dismiss message" tabIndex={toastOpen ? 0 : -1} onClick={() => setToastOpen(false)}>×</button></div>


    </div>
  );
}
