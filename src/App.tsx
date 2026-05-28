import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Filter,
  ImageIcon,
  Layers3,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { pipelineAssets, pipelineSummary } from './data/generatedAssets';
import type { PipelineAsset, ReviewDecision } from './types';

const themeLabels: Record<PipelineAsset['theme'], string> = {
  forest: 'Forest',
  snow: 'Snow',
  volcano: 'Volcano',
  base: 'Base',
};

const decisionLabels: Record<ReviewDecision, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  retry: 'Retry',
};

function formatCredits(value: number) {
  return value.toLocaleString('en-US');
}

function getImage(asset: PipelineAsset) {
  return asset.previewUrl ?? asset.conceptUrl;
}

function App() {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<'all' | PipelineAsset['theme']>('all');
  const [status, setStatus] = useState<'all' | PipelineAsset['status']>('all');
  const [creditBand, setCreditBand] = useState<'all' | 'low' | 'standard'>('all');
  const [selectedId, setSelectedId] = useState(pipelineAssets[0]?.id ?? '');
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});

  const enrichedAssets = useMemo(
    () => pipelineAssets.map((asset) => ({
      ...asset,
      decision: decisions[asset.id] ?? 'pending',
    })),
    [decisions],
  );

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return enrichedAssets.filter((asset) => {
      const matchesQuery = !normalizedQuery
        || asset.asset.toLowerCase().includes(normalizedQuery)
        || asset.prompt.toLowerCase().includes(normalizedQuery)
        || asset.category.toLowerCase().includes(normalizedQuery);
      const matchesTheme = theme === 'all' || asset.theme === theme;
      const matchesStatus = status === 'all' || asset.status === status;
      const matchesCredits = creditBand === 'all'
        || (creditBand === 'low' && asset.consumedCredits < 30)
        || (creditBand === 'standard' && asset.consumedCredits >= 30);

      return matchesQuery && matchesTheme && matchesStatus && matchesCredits;
    });
  }, [creditBand, enrichedAssets, query, status, theme]);

  const selectedAsset = useMemo(() => {
    return filteredAssets.find((asset) => asset.id === selectedId) ?? filteredAssets[0] ?? enrichedAssets[0];
  }, [enrichedAssets, filteredAssets, selectedId]);

  const liveStats = useMemo(() => {
    const approved = Object.values(decisions).filter((decision) => decision === 'approved').length;
    const rejected = Object.values(decisions).filter((decision) => decision === 'rejected').length;
    const retry = Object.values(decisions).filter((decision) => decision === 'retry').length;
    return {
      approved,
      rejected,
      retry,
      pending: pipelineSummary.totalAssets - approved - rejected - retry,
    };
  }, [decisions]);

  const setDecision = (assetId: string, decision: ReviewDecision) => {
    setDecisions((current) => ({
      ...current,
      [assetId]: decision,
    }));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Unity AIGC Asset Pipeline Portfolio</p>
          <h1>Pal Defense AIGC Pipeline</h1>
          <p className="subtitle">53 Meshy assets, 1,575 credits, three biome batches, and a dry-run orchestration proof.</p>
        </div>
        <div className="topbar-actions" aria-label="Portfolio links">
          <a href="evidence/metrics.json">Evidence JSON</a>
          <a href="https://github.com/leinay633-maker/pal-defense-aigc-pipeline-portfolio">GitHub</a>
          <div className="build-meta">
            <span>Generated data</span>
            <strong>{new Date(pipelineSummary.generatedAt).toLocaleDateString('en-US')}</strong>
          </div>
        </div>
      </header>

      <section className="kpi-grid" aria-label="Pipeline metrics">
        <Metric icon={<Layers3 />} label="Assets" value={pipelineSummary.totalAssets} detail={`${pipelineSummary.succeededAssets} succeeded`} />
        <Metric icon={<Coins />} label="Credits" value={formatCredits(pipelineSummary.totalCredits)} detail={`${pipelineSummary.averageCredits} avg / asset`} />
        <Metric icon={<ClipboardCheck />} label="Dry-run gate" value="53/53" detail="public evidence passed" />
        <Metric icon={<RotateCcw />} label="Review state" value={liveStats.pending} detail={`${liveStats.approved} approved`} />
      </section>

      <section className="workspace">
        <aside className="filters" aria-label="Filters">
          <div className="panel-title">
            <Filter size={18} />
            <h2>Filters</h2>
          </div>

          <label className="search-field">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search asset or prompt"
            />
          </label>

          <FilterGroup label="Theme">
            <SegmentedButton active={theme === 'all'} onClick={() => setTheme('all')}>All</SegmentedButton>
            {Object.keys(themeLabels).map((key) => (
              <SegmentedButton
                key={key}
                active={theme === key}
                onClick={() => setTheme(key as PipelineAsset['theme'])}
              >
                {themeLabels[key as PipelineAsset['theme']]}
              </SegmentedButton>
            ))}
          </FilterGroup>

          <FilterGroup label="Status">
            <SegmentedButton active={status === 'all'} onClick={() => setStatus('all')}>All</SegmentedButton>
            <SegmentedButton active={status === 'SUCCEEDED'} onClick={() => setStatus('SUCCEEDED')}>Succeeded</SegmentedButton>
            <SegmentedButton active={status === 'FAILED'} onClick={() => setStatus('FAILED')}>Failed</SegmentedButton>
          </FilterGroup>

          <FilterGroup label="Credits">
            <SegmentedButton active={creditBand === 'all'} onClick={() => setCreditBand('all')}>All</SegmentedButton>
            <SegmentedButton active={creditBand === 'low'} onClick={() => setCreditBand('low')}>Under 30</SegmentedButton>
            <SegmentedButton active={creditBand === 'standard'} onClick={() => setCreditBand('standard')}>30+</SegmentedButton>
          </FilterGroup>

          <div className="theme-breakdown">
            {Object.entries(pipelineSummary.byTheme).map(([themeName, count]) => (
              <div key={themeName}>
                <span>{themeName}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </aside>

        <section className="asset-section" aria-label="Asset review grid">
          <div className="section-toolbar">
            <div>
              <h2>Asset Queue</h2>
              <p>{filteredAssets.length} visible assets</p>
            </div>
            <div className="queue-legend">
              <span><i className="dot success" /> Generated</span>
              <span><i className="dot review" /> Needs review</span>
            </div>
          </div>

          <div className="asset-grid">
            {filteredAssets.map((asset) => (
              <button
                className={`asset-card ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                type="button"
              >
                <AssetImage asset={asset} />
                <span className={`decision-badge ${asset.decision}`}>{decisionLabels[asset.decision]}</span>
                <div className="asset-card-body">
                  <span className="asset-theme">{themeLabels[asset.theme]}</span>
                  <strong>{asset.displayName}</strong>
                  <span>{asset.category} / {asset.consumedCredits} credits</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {selectedAsset && (
          <aside className="details" aria-label="Selected asset details">
            <div className="details-header">
              <div>
                <span className="asset-theme">{themeLabels[selectedAsset.theme]}</span>
                <h2>{selectedAsset.displayName}</h2>
              </div>
              <span className={`status-pill ${selectedAsset.status.toLowerCase()}`}>{selectedAsset.status}</span>
            </div>

            <div className="image-compare">
              <ImagePanel label="Concept" src={selectedAsset.conceptUrl} />
              <ImagePanel label="Preview" src={selectedAsset.previewUrl} />
            </div>

            <div className="detail-stats">
              <DataPoint label="Credits" value={selectedAsset.consumedCredits} />
              <DataPoint label="Category" value={selectedAsset.category} />
              <DataPoint label="FBX" value={selectedAsset.hasFbx ? 'Yes' : 'No'} />
              <DataPoint label="Material" value={selectedAsset.hasMaterial ? 'Yes' : 'No'} />
            </div>

            <section className="prompt-panel">
              <h3>Prompt</h3>
              <p>{selectedAsset.prompt}</p>
            </section>

            <section className="trace-panel">
              <h3>Trace</h3>
              <TraceRow label="Source" value={selectedAsset.sourceDir} />
              <TraceRow label="Text to image" value={selectedAsset.textToImageTask ?? 'N/A'} />
              <TraceRow label="Image to 3D" value={selectedAsset.imageTo3dTask ?? 'N/A'} />
            </section>

            <div className="review-actions">
              <button type="button" onClick={() => setDecision(selectedAsset.id, 'approved')} className="action approve">
                <CheckCircle2 size={18} />
                Approve
              </button>
              <button type="button" onClick={() => setDecision(selectedAsset.id, 'rejected')} className="action reject">
                <XCircle size={18} />
                Reject
              </button>
              <button type="button" onClick={() => setDecision(selectedAsset.id, 'retry')} className="action retry">
                <RotateCcw size={18} />
                Retry
              </button>
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number | string; detail: string }) {
  return (
    <article className="metric">
      <span className="metric-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      <div className="segmented">{children}</div>
    </div>
  );
}

function SegmentedButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {children}
    </button>
  );
}

function AssetImage({ asset }: { asset: PipelineAsset }) {
  const image = getImage(asset);
  if (!image) {
    return (
      <div className="asset-image empty">
        <ImageIcon size={28} />
      </div>
    );
  }

  return (
    <img className="asset-image" src={image} alt={`${asset.displayName} preview`} loading="lazy" />
  );
}

function ImagePanel({ label, src }: { label: string; src?: string }) {
  return (
    <figure>
      <figcaption>{label}</figcaption>
      {src ? <img src={src} alt={`${label} asset visual`} /> : <div className="image-missing"><ImageIcon size={24} />Missing</div>}
    </figure>
  );
}

function DataPoint({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="data-point">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="trace-row">
      <span>{label}</span>
      <code>{value}</code>
      <ChevronRight size={14} />
    </div>
  );
}

export default App;
