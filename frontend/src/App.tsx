import { useEffect, useState } from 'react';
import LandingPage from './LandingPage';
import UploadPage from './UploadPage';
import type { CompletedAnalysis } from './api';

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const [result, setResult] = useState<CompletedAnalysis | null>(null);
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash);
      if (['#upload', '#review', '#top'].includes(window.location.hash)) window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const inUpload = route === '#upload' || route === '#review';
  const completed = route === '#review' ? result : null;
  useEffect(() => {
    document.title = inUpload ? `ClauseCheck — ${completed ? 'Analysis ready' : 'Upload your agreement'}` : 'ClauseCheck — Review agreements before you sign';
    if (route === '#review' && !result) window.location.replace('#upload');
  }, [route, inUpload, completed, result]);
  return inUpload ? <UploadPage key={completed ? 'completed' : 'upload'} result={completed}
    onStart={() => setResult(null)}
    onComplete={data => { setResult(data); window.location.hash = 'review'; }}
    onReset={() => { setResult(null); window.location.hash = 'upload'; }}/>
    : <LandingPage onReviewDocument={() => { window.location.hash = 'upload'; }}/>;
}
