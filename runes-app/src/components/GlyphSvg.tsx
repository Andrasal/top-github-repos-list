import type { Check } from '../engine/audit';
import type { Seg } from '../engine/geometry';
import { VIEW, apply, fitTransform, pathData } from '../engine/svg';

interface Props {
  segments: Seg[];
  kind: 'bindrune' | 'helm';
  checks?: Check[];
  showIssues?: boolean;
  title: string;
  size?: number | string;
  className?: string;
}

/** Renders engine segments as SVG (spec §6), with optional audit highlights. */
export function GlyphSvg({ segments, kind, checks = [], showIssues = true, title, size = '100%', className }: Props) {
  const f = fitTransform(segments, kind);
  const stroke = kind === 'helm' ? 7 : 10;
  const issues = showIssues ? checks.filter((c) => c.status !== 'pass') : [];
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <path
        d={pathData(segments, f)}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {issues.map((c) => (
        <g key={c.id} className={`hl hl-${c.status}`}>
          {c.segs && (
            <path
              d={pathData(c.segs.map((i) => segments[i]).filter(Boolean), f)}
              fill="none"
              strokeWidth={stroke * 0.45}
              strokeLinecap="round"
              strokeDasharray={c.status === 'warn' ? '6 6' : undefined}
            />
          )}
          {c.points?.map((p, i) => {
            const q = apply(p, f);
            return <circle key={i} cx={q.x} cy={q.y} r={stroke * 1.3} fill="none" strokeWidth={2.5} />;
          })}
        </g>
      ))}
    </svg>
  );
}
