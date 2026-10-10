import { useEffect, useRef, useState } from 'react';
import type { PlotSpec } from '../../core/simulations/types';

type PlotlyModule = typeof import('plotly.js-dist-min');
let plotlyPromise: Promise<PlotlyModule> | null = null;
/** Plotly é grande: carregado sob demanda na primeira vez que um gráfico aparece. */
function loadPlotly(): Promise<PlotlyModule> {
  plotlyPromise ??= import('plotly.js-dist-min').then((m) => ((m as unknown as { default?: PlotlyModule }).default ?? m) as PlotlyModule);
  return plotlyPromise;
}

const COLORS = ['#4fd1c5', '#7aa2ff', '#f6ad55', '#f687b3', '#b794f4', '#68d391', '#fc8181', '#faf089'];

export interface PlotProps {
  spec: PlotSpec;
  logX?: boolean;
  logY?: boolean;
  height?: number;
}

export function Plot({ spec, logX, logY, height = 360 }: PlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPlotly()
      .then((Plotly) => {
        if (cancelled || !ref.current) return;
        const data = spec.traces.map((t, i) => ({
          type: 'scatter' as const,
          mode: t.mode ?? 'lines',
          name: t.name,
          x: t.x,
          y: t.y,
          connectgaps: false,
          line: { color: COLORS[i % COLORS.length], width: 2, dash: t.dash ? ('dash' as const) : ('solid' as const) },
          marker: { color: COLORS[i % COLORS.length], size: 7 },
        }));
        const axis = {
          gridcolor: '#1e2a45',
          zerolinecolor: '#33456e',
          linecolor: '#33456e',
          tickfont: { color: '#8d9bb8' },
          exponentformat: 'power' as const,
        };
        const layout = {
          title: { text: spec.title, font: { size: 14, color: '#e3e9f6' } },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: '#0b1222',
          font: { family: 'Inter, system-ui, sans-serif', color: '#e3e9f6' },
          margin: { l: 60, r: 20, t: 40, b: 50 },
          height,
          showlegend: spec.traces.length > 1,
          legend: { orientation: 'h' as const, y: -0.22, font: { size: 11 } },
          xaxis: { ...axis, title: { text: spec.xLabel }, type: logX ? ('log' as const) : ('linear' as const) },
          yaxis: {
            ...axis,
            title: { text: spec.yLabel },
            type: logY ? ('log' as const) : ('linear' as const),
            ...(spec.equalAxes ? { scaleanchor: 'x' as const, scaleratio: 1 } : {}),
          },
          hovermode: 'closest' as const,
          separators: ',.', // vírgula decimal (pt-BR)
        };
        return Plotly.react(ref.current, data, layout, {
          responsive: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          toImageButtonOptions: { filename: spec.title.replace(/\s+/g, '_') },
        });
      })
      .then(() => {
        if (!cancelled) {
          setLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [spec, logX, logY, height]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) loadPlotly().then((P) => P.purge(el));
    };
  }, []);

  return (
    <div>
      {loading && <div className="plot-loading">Carregando gráfico…</div>}
      {error && <div className="result error">Erro ao desenhar o gráfico: {error}</div>}
      <div ref={ref} className="plot" style={{ display: loading ? 'none' : 'block' }} />
    </div>
  );
}
