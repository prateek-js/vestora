import { createRoot } from 'react-dom/client';
import { SeoLandingPage } from '../components/SeoLandingPage';
import { SeoPageSlug } from '../data/seoPages';
import { initAnalytics } from '../utils/analytics';
import '../index.css';

initAnalytics();

const rootEl = document.getElementById('root')!;
const slug = (rootEl.dataset.seoSlug as SeoPageSlug) || 'home-loan-vs-fd-calculator';

createRoot(rootEl).render(<SeoLandingPage slug={slug} />);
