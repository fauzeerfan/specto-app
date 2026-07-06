import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Thermometer,
  Droplets,
  CloudFog,
  Flame,
  AlertCircle,
  CheckCircle,
  Cpu,
  Wifi,
  WifiOff,
  Calendar,
  RefreshCw,
  Search,
  Activity,
  History,
  AlertTriangle,
  FileText
} from 'lucide-react';
import ReportDialog from '../components/ReportDialog';
import type { ReportHistoryPoint } from '../utils/reportGenerator';
import { getApiUrl } from '../config/api';

// --- INTERFACES ---
interface SpectoLatestData {
  id: number;
  temperature: number | null;
  humidity: number | null;
  smoke: number | null;
  flame: number | null;
  created_at: string;
}

interface SpectoEvent {
  id: number;
  created_at: string;
  sensor: 'TEMP' | 'HUM' | 'SMOKE' | 'FLAME';
  value: number;
  status: 'OK' | 'WARN' | 'ALERT';
}

type FilterType = '24h' | '7d' | '30d' | 'custom';

// --- DEVICE CONFIGURATION ---
interface Thresholds {
  tempMin: number;
  tempMax: number;
  humMin: number;
  humMax: number;
  smokeMax: number;
  flameMin: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  tempMin: 18, tempMax: 27, humMin: 20, humMax: 80, smokeMax: 4000, flameMin: 200,
};
const CONNECTION_TIMEOUT_MS = 30000;

const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
};

const getControlPoint = (current: any, previous: any, next: any, reverse?: boolean) => {
  const p = previous || current;
  const n = next || current;
  const smoothing = 0.2;
  const oppLine = { length: 0, angle: 0 };
  const lengthX = n.x - p.x;
  const lengthY = n.y - p.y;
  oppLine.length = Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2));
  oppLine.angle = Math.atan2(lengthY, lengthX);
  const angle = oppLine.angle + (reverse ? Math.PI : 0);
  const length = oppLine.length * smoothing;
  const x = current.x + Math.cos(angle) * length;
  const y = current.y + Math.sin(angle) * length;
  return { x, y };
};

const createSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  return points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const cps = getControlPoint(a[i - 1], a[i - 2], point);
    const cpe = getControlPoint(point, a[i - 1], a[i + 1], true);
    return `${acc} C ${cps.x},${cps.y} ${cpe.x},${cpe.y} ${point.x},${point.y}`;
  }, '');
};

// --- METRIC CARD ---
interface MetricCardProps {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: number | null;
  unit?: string;
  status?: 'OK' | 'WARNING' | 'ALERT';
  min?: number;
  max?: number;
  current?: number | null;
  alertThreshold?: number;
  isConnected: boolean;
  isSmokeOrFlame?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon, label, value, unit, status, min = 0, max = 100, current, isConnected, isSmokeOrFlame = false
}) => {
  const isAlert = status === 'ALERT';
  const isWarning = status === 'WARNING';
  const showProgress = label === 'Temperature' || label === 'Humidity';

  const visualMin = min - (max - min) * 0.2;
  const visualMax = max + (max - min) * 0.2;
  const progress = current ? ((current - visualMin) / (visualMax - visualMin)) * 100 : 0;

  let displayValue = '--';
  let mainTextColor = 'text-gray-900 dark:text-white';

  if (isConnected && value !== null) {
    if (isSmokeOrFlame) {
      if (isAlert) {
        displayValue = 'DANGER';
        mainTextColor = 'text-red-600 dark:text-red-400';
      } else {
        displayValue = 'SAFE';
        mainTextColor = 'text-emerald-600 dark:text-emerald-400';
      }
    } else {
      displayValue = Math.floor(value).toString();
    }
  }

  let statusColor = 'bg-gradient-to-br from-blue-500 to-cyan-400';
  if (isAlert) statusColor = 'bg-gradient-to-br from-red-500 to-orange-400';
  if (isWarning) statusColor = 'bg-gradient-to-br from-amber-500 to-yellow-400';
  if (!isConnected) statusColor = 'bg-gray-400';

  return (
    <div className={`group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border p-6 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 overflow-hidden ${
      isAlert ? 'border-red-200 dark:border-red-900/50' :
      isWarning ? 'border-amber-200 dark:border-amber-900/50' :
      'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
    }`}>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
            <div className="flex items-baseline mt-2">
              <p className={`text-3xl font-bold ${mainTextColor}`}>
                {displayValue}
                {unit && isConnected && value !== null && !isSmokeOrFlame && (
                  <span className="ml-1 text-lg text-gray-500 dark:text-gray-400">{unit}</span>
                )}
              </p>
            </div>
          </div>
          <div className={`p-3 rounded-xl shadow-lg transition-colors duration-300 ${statusColor}`}>
            <Icon size={24} className="text-white" />
          </div>
        </div>

        {showProgress && (
          <div className="mt-4 opacity-100 transition-opacity duration-300">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span className="font-medium">{min}{unit}</span>
              <span className="font-medium">Standard</span>
              <span className="font-medium">{max}{unit}</span>
            </div>
            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
              {isConnected && current !== null && (
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isAlert ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                />
              )}
            </div>
          </div>
        )}

        {isConnected && value !== null ? (
          <div className="mt-4 flex items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm ${
              isAlert ? 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30'
                : isWarning ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
            }`}>
              {isSmokeOrFlame ? (
                isAlert ? <><AlertCircle size={14} className="mr-1.5" />DETECTED</> : <><CheckCircle size={14} className="mr-1.5" />SAFE</>
              ) : (
                isAlert ? <><AlertCircle size={14} className="mr-1.5" />CRITICAL</> : isWarning ? <><AlertCircle size={14} className="mr-1.5" />WARNING</> : <><CheckCircle size={14} className="mr-1.5" />NORMAL</>
              )}
            </span>
            {isSmokeOrFlame && (
              <span className="text-[10px] text-gray-400 font-mono">Val: {value.toFixed(0)}</span>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {!isConnected ? 'DISCONNECTED' : 'WAITING...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- HISTORY CHART ---
interface HistoryChartProps {
  data: ReportHistoryPoint[];
  isLoading: boolean;
  dateRange: { start: string; end: string };
  thresholds: { tempMin: number; tempMax: number; humMin: number; humMax: number };
}

const HistoryChart: React.FC<HistoryChartProps> = ({ data, isLoading, dateRange, thresholds }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const height = 220;
  const paddingX = 50;
  const paddingY = 20;
  const chartHeight = height - paddingY * 2;
  const chartWidth = width - paddingX * 2;

  const chartData = useMemo(() => {
    if (!data.length || width === 0) return null;
    const minTemp = 15, maxTemp = 35, minHum = 0, maxHum = 100;
    const xStep = chartWidth / (data.length - 1 || 1);

    const points = data.map((d, i) => ({
      x: paddingX + i * xStep,
      yTemp: paddingY + chartHeight - ((d.temperature - minTemp) / (maxTemp - minTemp)) * chartHeight,
      yHum: paddingY + chartHeight - ((d.humidity - minHum) / (maxHum - minHum)) * chartHeight,
      original: d
    }));

    const tempPath = createSmoothPath(points.map(p => ({ x: p.x, y: p.yTemp })));
    const humPath = createSmoothPath(points.map(p => ({ x: p.x, y: p.yHum })));
    const tempArea = `${tempPath} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;
    const humArea = `${humPath} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

    const xTicks: { x: number; label: string }[] = [];
    const startT = new Date(dateRange.start).getTime();
    const endT = new Date(dateRange.end).getTime();
    const durationHours = (endT - startT) / (1000 * 60 * 60);
    const isMultiDay = durationHours > 30;
    const tickInterval = Math.max(1, Math.floor(points.length / 7));

    points.forEach((p, i) => {
      if (i % tickInterval === 0 || i === points.length - 1) {
        const date = new Date(p.original.created_at);
        const label = isMultiDay
          ? date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })
          : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        xTicks.push({ x: p.x, label });
      }
    });

    return { points, tempPath, tempArea, humPath, humArea, xTicks };
  }, [data, width, chartWidth, chartHeight, dateRange]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !chartData) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let minDist = Infinity;
    let nearestIdx = 0;
    chartData.points.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) { minDist = dist; nearestIdx = i; }
    });
    setHoverIndex(nearestIdx);
  };

  const activePoint = (chartData && hoverIndex !== null) ? chartData.points[hoverIndex] : null;

  if (isLoading) return <div className="h-[250px] w-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"><RefreshCw className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Activity size={16} className="text-blue-500" />Temperature & Humidity Trends</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span><span className="text-xs font-medium text-gray-600 dark:text-gray-400">Temp (Std: {thresholds.tempMin}-{thresholds.tempMax})</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span><span className="text-xs font-medium text-gray-600 dark:text-gray-400">Hum (Std: {thresholds.humMin}-{thresholds.humMax})</span></div>
        </div>
      </div>
      <div ref={containerRef} className="relative w-full h-[220px] cursor-crosshair" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)}>
        {(!data.length || width === 0) ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">{!data.length ? 'No data available for this range' : 'Initializing...'}</div>
        ) : chartData && (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="gradTempSmooth" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0" /></linearGradient>
              <linearGradient id="gradHumSmooth" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
              const y = paddingY + chartHeight * r;
              return <line key={i} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" className="text-gray-100 dark:text-gray-700/30" strokeWidth="1" />;
            })}
            {chartData.xTicks.map((tick, i) => (
              <React.Fragment key={i}>
                <line x1={tick.x} y1={paddingY} x2={tick.x} y2={height - paddingY} stroke="currentColor" className="text-gray-200 dark:text-gray-700/30" strokeWidth="1" />
                <text x={tick.x} y={height - paddingY + 15} textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">{tick.label}</text>
              </React.Fragment>
            ))}
            <rect x={paddingX} y={paddingY + chartHeight - ((thresholds.tempMax - 15) / 20) * chartHeight} width={chartWidth} height={(chartHeight / 20) * (thresholds.tempMax - thresholds.tempMin)} fill="rgba(239, 68, 68, 0.05)" />
            <rect x={paddingX} y={paddingY + chartHeight - ((thresholds.humMax - 0) / 100) * chartHeight} width={chartWidth} height={(chartHeight / 100) * (thresholds.humMax - thresholds.humMin)} fill="rgba(59, 130, 246, 0.05)" />
            <path d={chartData.humArea} fill="url(#gradHumSmooth)" />
            <path d={chartData.humPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />
            <path d={chartData.tempArea} fill="url(#gradTempSmooth)" />
            <path d={chartData.tempPath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />
            {activePoint && (
              <g>
                <line x1={activePoint.x} y1={paddingY} x2={activePoint.x} y2={height - paddingY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx={activePoint.x} cy={activePoint.yHum} r="5" className="fill-blue-500 stroke-white dark:stroke-gray-800 stroke-2" />
                <circle cx={activePoint.x} cy={activePoint.yTemp} r="5" className="fill-red-500 stroke-white dark:stroke-gray-800 stroke-2" />
              </g>
            )}
            <text x={paddingX - 10} y={height - paddingY} textAnchor="end" className="text-[10px] fill-gray-400 font-medium">15°</text>
            <text x={paddingX - 10} y={paddingY + 5} textAnchor="end" className="text-[10px] fill-gray-400 font-medium">35°</text>
            <text x={width - paddingX + 10} y={height - paddingY} textAnchor="start" className="text-[10px] fill-gray-400 font-medium">0%</text>
            <text x={width - paddingX + 10} y={paddingY + 5} textAnchor="start" className="text-[10px] fill-gray-400 font-medium">100%</text>
          </svg>
        )}
        {activePoint && width > 0 && (
          <div className="absolute z-20 pointer-events-none bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 text-xs transform -translate-x-1/2 -translate-y-full transition-all duration-75 ease-out" style={{ left: activePoint.x, top: Math.min(activePoint.yTemp, activePoint.yHum) - 15 }}>
            <div className="font-bold text-gray-700 dark:text-gray-200 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">{new Date(activePoint.original.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span><span className="text-gray-500 dark:text-gray-400">Temp:</span><span className="font-bold text-gray-800 dark:text-white">{Math.floor(activePoint.original.temperature)}°C</span></div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span><span className="text-gray-500 dark:text-gray-400">Hum:</span><span className="font-bold text-gray-800 dark:text-white">{Math.floor(activePoint.original.humidity)}%</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- INCIDENT LOGS ---
const IncidentLogs: React.FC<{ events: SpectoEvent[]; dateRange: { start: string; end: string } }> = ({ events, dateRange }) => {
  const incidents = useMemo(() => {
    const startMs = new Date(dateRange.start).getTime();
    const endMs = new Date(dateRange.end).getTime();
    return events.filter(e => {
      const timeMs = new Date(e.created_at).getTime();
      return e.status !== 'OK' && timeMs >= startMs && timeMs <= endMs;
    });
  }, [events, dateRange]);

  const getIncidentMessage = (event: SpectoEvent) => {
    const s = event.sensor ? event.sensor.toUpperCase() : '';
    if (s.includes('SMOKE')) return 'Smoke detected above threshold';
    if (s.includes('FLAME')) return 'Fire detected';
    if (s.includes('TEMP')) return event.status === 'ALERT' ? 'Critical Temperature' : 'Abnormal Temperature';
    if (s.includes('HUM')) return event.status === 'ALERT' ? 'Critical Humidity' : 'Abnormal Humidity';
    return 'Sensor reading abnormal';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <History size={20} className="text-orange-500" />
        <h3 className="font-bold text-gray-800 dark:text-gray-200">Incident Logs</h3>
      </div>
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th className="px-6 py-3 font-medium">Time</th>
              <th className="px-6 py-3 font-medium">Sensor</th>
              <th className="px-6 py-3 font-medium">Value</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle size={24} className="text-emerald-500" />
                    <p>No abnormal incidents recorded in this period.</p>
                  </div>
                </td>
              </tr>
            ) : (
              incidents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200 uppercase">
                    {event.sensor}
                  </td>
                  <td className="px-6 py-3 font-mono text-gray-600 dark:text-gray-300">
                    {event.value}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      event.status === 'ALERT'
                        ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                        : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                    }`}>
                      {event.status === 'ALERT' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                    {getIncidentMessage(event)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---
interface MonitoringDashboardProps {
  deviceId: string;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ deviceId }) => {
  const title = 'Specto Server';

  const [latest, setLatest] = useState<SpectoLatestData | null>(null);
  const [events, setEvents] = useState<SpectoEvent[]>([]);
  const [history, setHistory] = useState<ReportHistoryPoint[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  const [currentThresholds, setCurrentThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const [activeFilter, setActiveFilter] = useState<FilterType>('24h');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return toLocalISOString(d);
  });
  const [endDate, setEndDate] = useState(() => toLocalISOString(new Date()));

  const isLiveMonitoring = activeFilter === '24h';
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Ambil ambang batas dari server (dapat diubah di System Settings) & refresh berkala.
  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const res = await fetch(getApiUrl('/api/settings/thresholds'));
        if (!res.ok) return;
        const d = await res.json();
        setCurrentThresholds({
          tempMin: d.temp_min, tempMax: d.temp_max,
          humMin: d.hum_min, humMax: d.hum_max,
          smokeMax: d.smoke_max, flameMin: d.flame_min,
        });
      } catch {
        /* pertahankan nilai terakhir/default bila gagal */
      }
    };
    fetchThresholds();
    const id = setInterval(fetchThresholds, 15000);
    return () => clearInterval(id);
  }, []);

  const fetchLatest = async () => {
    try {
      const url = getApiUrl(`/api/specto-data/latest?deviceId=${deviceId}`);
      console.log('[MonitoringDashboard] Fetching latest from:', url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const rawData = await res.json();
      console.log('[MonitoringDashboard] Raw latest data:', rawData);
      if (!rawData) { setLatest(null); setConnectionStatus('disconnected'); return; }

      const now = new Date();
      const dataTime = new Date(rawData.created_at);
      if (now.getTime() - dataTime.getTime() > CONNECTION_TIMEOUT_MS) {
        setConnectionStatus('disconnected');
        setLatest(null);
        return;
      }

      const mappedData: SpectoLatestData = {
        id: rawData.id,
        temperature: rawData.temperature,
        humidity: rawData.humidity,
        smoke: rawData.smoke_level ?? rawData.smoke ?? null,
        flame: rawData.flame_level ?? rawData.flame ?? null,
        created_at: rawData.created_at,
      };
      setLatest(mappedData);
      setConnectionStatus('connected');
    } catch (err) {
      console.error('[MonitoringDashboard] fetchLatest error:', err);
      setLatest(null);
      setConnectionStatus('disconnected');
    }
  };

  const fetchEvents = async () => {
    try {
      const url = getApiUrl(`/api/specto-data/events?deviceId=${deviceId}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setEvents([]);
    }
  };

  const fetchHistory = async (start = startDate, end = endDate) => {
    if (!isLiveMonitoring) setIsHistoryLoading(true);
    try {
      const startISO = new Date(start).toISOString();
      const endISO = new Date(end).toISOString();
      const qs = new URLSearchParams({ startDate: startISO, endDate: endISO, deviceId });
      const url = getApiUrl(`/api/specto-data/history?${qs.toString()}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    setLatest(null);
    setEvents([]);
    setHistory([]);
    setConnectionStatus('disconnected');
    fetchLatest();
    fetchEvents();
    fetchHistory();

    const interval = setInterval(() => {
      fetchLatest();
      fetchEvents();
      if (isLiveMonitoring) {
        const now = new Date();
        const start = new Date();
        start.setHours(now.getHours() - 24);
        fetchHistory(toLocalISOString(start), toLocalISOString(now));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isLiveMonitoring, deviceId]);

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    const now = new Date();
    let start = new Date();

    if (filter === '24h') start.setHours(now.getHours() - 24);
    else if (filter === '7d') start.setDate(now.getDate() - 7);
    else if (filter === '30d') start.setDate(now.getDate() - 30);
    else return;

    const s = toLocalISOString(start);
    const e = toLocalISOString(now);
    setStartDate(s);
    setEndDate(e);
    fetchHistory(s, e);
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (activeFilter !== 'custom') setActiveFilter('custom');
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
  };

  const handleManualRefresh = () => fetchHistory();

  const getSystemStatus = () => {
    if (connectionStatus === 'disconnected' || !latest) return 'DISCONNECTED';
    const { temperature, humidity, smoke, flame } = latest;
    if (smoke !== null && smoke >= currentThresholds.smokeMax) return 'CRITICAL';
    if (flame !== null && flame <= currentThresholds.flameMin) return 'CRITICAL';
    if (temperature !== null && (temperature < currentThresholds.tempMin || temperature > currentThresholds.tempMax)) return 'WARNING';
    if (humidity !== null && (humidity < currentThresholds.humMin || humidity > currentThresholds.humMax)) return 'WARNING';
    return 'NORMAL';
  };

  const systemStatus = getSystemStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 md:p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl shadow-lg"><Cpu className="text-white" size={24} /></div>
              <div><h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{title}</h1></div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  {connectionStatus === 'connected' ? <Wifi size={16} className="text-emerald-500" /> : <WifiOff size={16} className="text-red-500" />}
                  <span className={`text-sm font-medium ${connectionStatus === 'connected' ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}`}>{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              <div className={`px-5 py-2.5 rounded-xl flex items-center gap-2.5 backdrop-blur-sm border transition-colors duration-500 ${
                systemStatus === 'NORMAL' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-500/30'
                : systemStatus === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-500/30'
                : systemStatus === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-500/30'
                : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${systemStatus === 'NORMAL' ? 'bg-emerald-500 animate-pulse' : systemStatus === 'WARNING' ? 'bg-amber-500 animate-pulse' : systemStatus === 'CRITICAL' ? 'bg-red-500 animate-ping' : 'bg-gray-400'}`} />
                <span className="font-semibold">{systemStatus === 'DISCONNECTED' ? 'OFFLINE' : `${systemStatus} SYSTEM`}</span>
              </div>
            </div>
            <button
              onClick={() => setShowReportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all font-medium"
            >
              <FileText size={18} />
              <span>Generate Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* No Data Warning (connected but no data) */}
      {connectionStatus === 'connected' && !latest && (
        <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl flex items-center gap-3">
          <AlertTriangle size={20} />
          <div>
            <p className="font-bold">No Sensor Data Received Yet</p>
            <p className="text-sm">
              The device appears connected but no data has been saved. Ensure the IoT device is sending data and check backend logs.
            </p>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={Thermometer} label="Temperature" value={latest?.temperature ?? null} unit="°C" min={currentThresholds.tempMin} max={currentThresholds.tempMax} current={latest?.temperature} status={latest ? (latest.temperature !== null && (latest.temperature < currentThresholds.tempMin || latest.temperature > currentThresholds.tempMax) ? 'WARNING' : 'OK') : 'OK'} isConnected={connectionStatus === 'connected'} />
        <MetricCard icon={Droplets} label="Humidity" value={latest?.humidity ?? null} unit="%" min={currentThresholds.humMin} max={currentThresholds.humMax} current={latest?.humidity} status={latest ? (latest.humidity !== null && (latest.humidity < currentThresholds.humMin || latest.humidity > currentThresholds.humMax) ? 'WARNING' : 'OK') : 'OK'} isConnected={connectionStatus === 'connected'} />
        <MetricCard icon={CloudFog} label="Smoke" value={latest?.smoke ?? null} status={latest && latest.smoke !== null ? latest.smoke >= currentThresholds.smokeMax ? 'ALERT' : 'OK' : 'OK'} alertThreshold={currentThresholds.smokeMax} current={latest?.smoke} isConnected={connectionStatus === 'connected'} isSmokeOrFlame={true} />
        <MetricCard icon={Flame} label="Flame" value={latest?.flame ?? null} status={latest && latest.flame !== null ? latest.flame <= currentThresholds.flameMin ? 'ALERT' : 'OK' : 'OK'} alertThreshold={currentThresholds.flameMin} current={latest?.flame} isConnected={connectionStatus === 'connected'} isSmokeOrFlame={true} />
      </div>

      {/* History & Analytics Section */}
      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Calendar size={20} className="text-blue-500" />Temperature & Humidity Trends</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monitor temperature and humidity trends over time</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex">
              {(['24h', '7d', '30d', 'custom'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeFilter === filter
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {filter === '24h' ? '24 Hours' : filter === '7d' ? '7 Days' : filter === '30d' ? '30 Days' : 'Custom'}
                </button>
              ))}
            </div>
            {activeFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-right-4">
                <input type="datetime-local" value={startDate} onChange={(e) => handleCustomDateChange('start', e.target.value)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <span className="text-gray-400 text-xs">-</span>
                <input type="datetime-local" value={endDate} onChange={(e) => handleCustomDateChange('end', e.target.value)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button onClick={handleManualRefresh} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg transition-colors" title="Apply Filter">
                  <Search size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="w-full">
          <HistoryChart data={history} isLoading={isHistoryLoading} dateRange={{ start: startDate, end: endDate }} thresholds={currentThresholds} />
        </div>
      </div>

      <IncidentLogs events={events} dateRange={{ start: startDate, end: endDate }} />

      <ReportDialog isOpen={showReportDialog} onClose={() => setShowReportDialog(false)} deviceId={deviceId} />
    </div>
  );
};

export default MonitoringDashboard;