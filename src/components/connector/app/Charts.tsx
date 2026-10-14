/** Lightweight SVG charts in the brand palette. */

export function LineChart({ data, labels, height = 220, color = "#673DE6" }: { data: number[]; labels?: string[]; height?: number; color?: string }) {
  const w = 600;
  const h = height;
  const pad = 28;
  const max = Math.max(...data, 1) * 1.1;
  const pts = data.map((v, i) => [pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1), h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]} ${h - pad} L${pts[0][0]} ${h - pad} Z`;
  const gid = `lg-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((k) => {
        const y = pad + (k * (h - pad * 2)) / 3;
        return <line key={k} x1={pad} x2={w - pad} y1={y} y2={y} stroke="#E3E4EE" strokeDasharray="4 4" />;
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke={color} strokeWidth="2">
          <title>{`${labels?.[i] ?? i + 1}: ${data[i]}`}</title>
        </circle>
      ))}
      {labels?.map((l, i) =>
        i % Math.ceil(labels.length / 7) === 0 ? (
          <text key={l + i} x={pts[i][0]} y={h - 6} textAnchor="middle" fontSize="11" fill="#6D7081">
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function BarChart({ data, labels, height = 200, color = "#673DE6" }: { data: number[]; labels: string[]; height?: number; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[11px] font-bold text-ink-2">{v}</span>
          <span
            className="w-full origin-bottom rounded-t-md"
            style={{ height: `${(v / max) * 78}%`, background: color, opacity: 0.55 + (v / max) * 0.45, animation: `demo-bar .8s ${i * 0.05}s both cubic-bezier(.2,.8,.2,1)` }}
            title={`${labels[i]}: ${v}`}
          />
          <span className="text-[11px] text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 15.9155;
  const pcts = parts.map((p) => (p.value / total) * 100);
  const offsets = pcts.map((_, i) => pcts.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 42 42" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="21" cy="21" r={r} fill="none" stroke="#F4F5FF" strokeWidth="6" />
        {parts.map((p, i) => (
          <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={p.color} strokeWidth="6" strokeDasharray={`${pcts[i]} ${100 - pcts[i]}`} strokeDashoffset={-offsets[i]} />
        ))}
      </svg>
      <ul className="space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
            <span className="text-ink-2">{p.label}</span>
            <span className="font-bold text-ink">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Kpi({ label, value, delta, up = true }: { label: string; value: string; delta?: string; up?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {delta && <p className={`mt-1 text-sm font-bold ${up ? "text-success" : "text-danger"}`}>{up ? "▲" : "▼"} {delta}</p>}
    </div>
  );
}
