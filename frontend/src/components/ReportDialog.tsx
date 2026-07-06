import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  Activity, 
  Calendar, 
  RefreshCw, 
  AlertTriangle, 
  AlertCircle, 
  Thermometer, 
  Droplets,
  Flame,
  CloudFog,
  Check
} from 'lucide-react';
import type { ReportPeriod, ReportHistoryPoint, ReportIncident, ReportHourlyStat } from '../utils/reportGenerator';
import {
  generateReportPDF,
  getDateRange,
  getStandards
} from '../utils/reportGenerator';
import { format, parseISO } from 'date-fns';
import { getApiUrl } from '../config/api';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
}


// Interface untuk data events dari API (sama dengan dashboard)
interface ApiEvent {
  id: number;
  created_at: string;
  sensor: 'TEMP' | 'HUM' | 'SMOKE' | 'FLAME';
  value: number;
  status: 'OK' | 'WARN' | 'ALERT';
}



// --- Interface untuk data laporan real (menggantikan ReportData) ---
interface RealReportData {
  period: ReportPeriod;
  dateRange: { start: Date; end: Date };
  deviceId: string;
  standards: { tempMin: number; tempMax: number; humMin: number; humMax: number; labelTemp: string; labelHum: string };
  history: ReportHistoryPoint[];
  incidents: ReportIncident[];
  hourlyStats: ReportHourlyStat[];
  avgTemp: number;
  avgHum: number;
  incidentCount: number;
  conclusion: string;
}

// --- CHART COMPONENT WITH DYNAMIC THRESHOLDS ---
const ReportChart: React.FC<{ 
  data: ReportHistoryPoint[]; 
  type: 'temp' | 'hum';
  standards: { 
    tempMin: number; 
    tempMax: number; 
    humMin: number; 
    humMax: number;
    labelTemp: string;
    labelHum: string;
  };
}> = ({ data, type, standards }) => {
  if (!data || data.length === 0) return <div className="h-40 w-full bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-xs text-slate-400">No data available</div>;

  const height = 150;
  const width = 400;
  const padding = 15;

  // Scale Config
  const isTemp = type === 'temp';
  
  // Dynamic axis based on standards
  const minAxis = isTemp ? Math.max(10, standards.tempMin - 5) : 0;
  const maxAxis = isTemp ? Math.min(40, standards.tempMax + 10) : 100;
  const range = maxAxis - minAxis;
  
  // Threshold Lines Y-Coordinates
  const upperLimit = isTemp ? standards.tempMax : standards.humMax;
  const lowerLimit = isTemp ? standards.tempMin : standards.humMin;
  
  const yUpper = height - padding - ((upperLimit - minAxis) / range) * (height - padding * 2);
  const yLower = height - padding - ((lowerLimit - minAxis) / range) * (height - padding * 2);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const val = isTemp ? d.temperature : d.humidity;
    // Clamp value visual inside chart
    const clampedVal = Math.max(minAxis, Math.min(maxAxis, val));
    const y = height - padding - ((clampedVal - minAxis) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const color = isTemp ? '#ef4444' : '#3b82f6';
  const bgGradientId = `grad-report-${type}`;

  return (
    <div className="h-40 w-full bg-white border border-slate-200 rounded overflow-hidden relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
         <defs>
            <linearGradient id={bgGradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
         </defs>

         {/* Standard Zone (Background Rect) */}
         <rect 
            x={padding} 
            y={yUpper} 
            width={width - padding*2} 
            height={yLower - yUpper} 
            fill={isTemp ? "rgba(34, 197, 94, 0.05)" : "rgba(59, 130, 246, 0.05)"} 
         />

         {/* Threshold Lines */}
         <line x1={padding} y1={yUpper} x2={width-padding} y2={yUpper} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" />
         <line x1={padding} y1={yLower} x2={width-padding} y2={yLower} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" />

         {/* Labels for Thresholds */}
         <text x={width - padding + 2} y={yUpper + 3} className="text-[8px] fill-slate-400 font-mono">Max {upperLimit}</text>
         <text x={width - padding + 2} y={yLower + 3} className="text-[8px] fill-slate-400 font-mono">Min {lowerLimit}</text>

         {/* Graph Area */}
         <path d={`M ${padding},${height} L ${points.split(' ')[0]} ${points} L ${width-padding},${height} Z`} fill={`url(#${bgGradientId})`} stroke="none" />
         <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Unit Label */}
      <div className="absolute top-2 left-3 text-[10px] font-bold text-slate-500 bg-white/80 px-1 rounded">
        {isTemp ? 'Celsius (°C)' : 'Humidity (%)'}
      </div>
    </div>
  );
};

// --- LOG ITEM COMPONENT ---
type CombinedLogItem = 
  | { type: 'INCIDENT'; data: ReportIncident }
  | { type: 'HOURLY'; data: ReportHourlyStat };

const ReportDialog: React.FC<ReportDialogProps> = ({ isOpen, onClose, deviceId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('daily');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [reportData, setReportData] = useState<RealReportData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // FILTER STATES
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'INCIDENT' | 'HOURLY'>('ALL');
  const [selectedSensors, setSelectedSensors] = useState<string[]>(['TEMP', 'HUM', 'SMOKE', 'FLAME']);
  const [thresholds, setThresholds] = useState<any>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/settings/thresholds'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setThresholds(d))
      .catch(() => {});
  }, []);

  const reportRef = useRef<HTMLDivElement>(null);
  
  // Get standards based on deviceId (hanya Specto Server)
  const standards = getStandards(thresholds);
  const deviceName = 'Server Room';

  const fetchReportData = async (period: ReportPeriod, startStr?: string, endStr?: string) => {
    setIsLoadingData(true);
    setError(null);
    try {
      let start: Date, end: Date;
      if (period === 'custom' && startStr && endStr) {
        start = parseISO(startStr);
        end = parseISO(endStr);
      } else {
        const range = getDateRange(period);
        start = range.start;
        end = range.end;
      }

      // 1. Fetch History Data
      const historyQs = new URLSearchParams({ 
        startDate: start.toISOString(), 
        endDate: end.toISOString(),
        deviceId: deviceId
      });
      const historyUrl = getApiUrl(`/api/specto-data/history?${historyQs.toString()}`);
      const historyRes = await fetch(historyUrl);
      if (!historyRes.ok) throw new Error('Failed to fetch history data');
      const historyData: ReportHistoryPoint[] = await historyRes.json();

      // 2. Fetch Events (Incidents)
      const eventsUrl = getApiUrl(`/api/specto-data/events?deviceId=${deviceId}`);
      const eventsRes = await fetch(eventsUrl);
      if (!eventsRes.ok) throw new Error('Failed to fetch events data');
      const apiEvents: ApiEvent[] = await eventsRes.json();

      // Filter incidents dalam range dan status bukan OK
      const realIncidents: ReportIncident[] = apiEvents
        .filter(event => {
          const eventTime = new Date(event.created_at);
          return eventTime >= start && eventTime <= end && event.status !== 'OK';
        })
        .map(event => {
          let severity: 'CRITICAL' | 'WARNING' = 'WARNING';
          if (event.status === 'ALERT') severity = 'CRITICAL';
          let description = '';
          const sensor = event.sensor;
          const value = event.value;
          if (sensor === 'TEMP') {
            description = value > standards.tempMax 
              ? `Temperature above ${standards.tempMax}°C` 
              : `Temperature below ${standards.tempMin}°C`;
          } else if (sensor === 'HUM') {
            description = value > standards.humMax 
              ? `Humidity above ${standards.humMax}%` 
              : `Humidity below ${standards.humMin}%`;
          } else if (sensor === 'SMOKE') {
            description = 'Smoke detected';
          } else if (sensor === 'FLAME') {
            description = 'Flame detected';
          } else {
            description = `${sensor} ${event.status === 'ALERT' ? 'Critical' : 'Warning'}: ${value}`;
          }
          return {
            id: event.id,
            time: event.created_at,
            severity,
            sensor: event.sensor,
            value: event.value,
            description,
          };
        })
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // 3. Fetch Hourly Stats (dari endpoint baru)
      const hourlyQs = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        deviceId: deviceId
      });
      const hourlyUrl = getApiUrl(`/api/specto-data/hourly-stats?${hourlyQs.toString()}`);
      const hourlyRes = await fetch(hourlyUrl);
      if (!hourlyRes.ok) throw new Error('Failed to fetch hourly stats');
      const hourlyData = await hourlyRes.json();
      
      const hourlyStats: ReportHourlyStat[] = hourlyData.map((item: any) => ({
        id: `hour-${item.id}`,
        time: item.time_bucket,
        avgTemp: item.avg_temp,
        avgHum: item.avg_hum,
        sampleCount: 60 // default
      }));

      // 4. Hitung metrics dari data real
      const avgTemp = historyData.length > 0 
        ? historyData.reduce((sum, p) => sum + p.temperature, 0) / historyData.length 
        : 0;
      const avgHum = historyData.length > 0 
        ? historyData.reduce((sum, p) => sum + p.humidity, 0) / historyData.length 
        : 0;
      const incidentCount = realIncidents.length;

      // 5. Generate conclusion text
      const conclusion = `Report for ${deviceName}. During this period, the overall system stability was monitored. ` +
        `Average temperature ${avgTemp.toFixed(1)}°C (standard ${standards.labelTemp}), ` +
        `average humidity ${avgHum.toFixed(1)}% (standard ${standards.labelHum}). ` +
        `Total incidents recorded: ${incidentCount}.`;

      setReportData({
        period,
        dateRange: { start, end },
        deviceId,
        standards,
        history: historyData,
        incidents: realIncidents,
        hourlyStats,
        avgTemp,
        avgHum,
        incidentCount,
        conclusion,
      });

    } catch (err) {
      console.error("Report fetch error:", err);
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReportData(selectedPeriod, customStart, customEnd);
    }
  }, [isOpen, selectedPeriod]);

  const handlePeriodChange = (period: ReportPeriod) => {
    setSelectedPeriod(period);
    if (period === 'custom') {
      const todayStr = new Date().toISOString().slice(0, 10);
      setCustomStart(prev => prev || todayStr);
      setCustomEnd(prev => prev || todayStr);
    } 
  };

  const handleCustomDateSearch = () => {
    if (selectedPeriod === 'custom') fetchReportData('custom', customStart, customEnd);
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') setCustomStart(value);
    else setCustomEnd(value);
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      if (reportRef.current?.id && reportData) {
        // Cast to any karena generateReportPDF mungkin mengharapkan ReportData lama,
        // tetapi properti yang dibutuhkan sudah ada di RealReportData.
        await generateReportPDF(reportData as any, reportRef.current.id);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleSensor = (sensor: string) => {
    setSelectedSensors(prev => 
      prev.includes(sensor) 
        ? prev.filter(s => s !== sensor)
        : [...prev, sensor]
    );
  };

  const getCombinedLogs = (): CombinedLogItem[] => {
    if (!reportData) return [];
    
    // 1. Convert Incidents
    const incLogs: CombinedLogItem[] = reportData.incidents.map(inc => ({
      type: 'INCIDENT',
      data: inc
    }));

    // 2. Convert Hourly Stats
    const hourLogs: CombinedLogItem[] = reportData.hourlyStats.map(stat => ({
      type: 'HOURLY',
      data: stat
    }));

    // 3. Merge & Sort by Time DESC
    let combined = [...incLogs, ...hourLogs].sort((a, b) => {
      const tA = a.type === 'INCIDENT' ? (a.data as ReportIncident).time : (a.data as ReportHourlyStat).time;
      const tB = b.type === 'INCIDENT' ? (b.data as ReportIncident).time : (b.data as ReportHourlyStat).time;
      return new Date(tB).getTime() - new Date(tA).getTime();
    });

    // 4. Apply Filters
    if (logTypeFilter !== 'ALL') {
      combined = combined.filter(item => item.type === logTypeFilter);
    }

    // Filter Multi-Sensor
    combined = combined.filter(item => {
      if (item.type === 'INCIDENT') {
         const d = item.data as ReportIncident;
         return selectedSensors.includes(d.sensor);
      }
      if (item.type === 'HOURLY') {
        return selectedSensors.includes('TEMP') || selectedSensors.includes('HUM');
      }
      return false;
    });

    return combined;
  };

  // Pindahkan filteredLogs ke sini (sebelum return) agar tersedia di JSX
  const filteredLogs = getCombinedLogs();

  if (!isOpen) return null;

  const periodLabel = selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-specto-surface-light dark:bg-specto-surface-dark rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-specto-border-light dark:border-slate-700">
        
        {/* Header Dialog */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-specto-border-light dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Generate System Report - {deviceName}
              </h2>
              <p className="text-xs text-slate-500">Pilih periode dan unduh laporan kinerja</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Container (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Sidebar Controls (3 Columns) */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Filter Period</label>
                <div className="space-y-2">
                  {(['daily', 'weekly', 'monthly', 'custom'] as const).map((period) => (
                    <button key={period} onClick={() => handlePeriodChange(period)} className={`w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition ${selectedPeriod === period ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600'}`}>
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
                {selectedPeriod === 'custom' && (
                   <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                     <div>
                       <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
                       <input type="date" value={customStart} onChange={(e) => handleCustomDateChange('start', e.target.value)} className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                     </div>
                     <div>
                       <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
                       <input type="date" value={customEnd} min={customStart} onChange={(e) => handleCustomDateChange('end', e.target.value)} className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                     </div>
                     <button onClick={handleCustomDateSearch} className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200">Terapkan Tanggal</button>
                   </div>
                )}
              </div>

              {/* Log Filters Multi-Select */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Log Filters</label>
                
                <div className="space-y-4">
                  {/* Filter Type */}
                  <div>
                    <span className="text-xs font-semibold text-slate-400 mb-2 block uppercase">Data Type</span>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                      {['ALL', 'INCIDENT', 'HOURLY'].map(t => (
                        <button 
                          key={t} 
                          onClick={() => setLogTypeFilter(t as any)} 
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                            logTypeFilter === t 
                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Filter Sensors Multi-Select */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase">Sensors</span>
                        <span className="text-[10px] text-slate-400">{selectedSensors.length} Selected</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'TEMP', label: 'Temperature', icon: Thermometer, color: 'text-red-500' },
                        { id: 'HUM', label: 'Humidity', icon: Droplets, color: 'text-blue-500' },
                        { id: 'SMOKE', label: 'Smoke Detector', icon: CloudFog, color: 'text-gray-500' },
                        { id: 'FLAME', label: 'Flame Sensor', icon: Flame, color: 'text-orange-500' },
                      ].map((s) => {
                        const isSelected = selectedSensors.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleSensor(s.id)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium border transition-all duration-200 group ${
                              isSelected 
                                ? 'bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100' 
                                : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-md ${isSelected ? 'bg-white dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-900'}`}>
                                    <s.icon size={14} className={s.color} />
                                </div>
                                <span>{s.label}</span>
                            </div>
                            <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                              {isSelected && <Check size={10} className="text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Preview (9 Columns) */}
            <div className="lg:col-span-9">
               {/* WRAPPER DIV FOR PDF GENERATION */}
               <div ref={reportRef} id="specto-report-container" className="bg-white text-slate-900 p-8 shadow-sm border border-slate-200 min-h-[1000px]">
                  
                  {/* Loading / Error / Content */}
                  {isLoadingData ? (
                    <div className="flex items-center justify-center h-64">
                      <RefreshCw className="animate-spin text-blue-500 mr-2" size={20} />
                      <span className="text-slate-600">Loading report data...</span>
                    </div>
                  ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
                      <AlertCircle className="inline mr-2" size={18} />
                      {error}
                    </div>
                  ) : reportData ? (
                    <>
                      {/* REPORT TITLE */}
                      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6">
                        <div>
                          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">SPECTO <span className="text-blue-600">REPORT</span></h1>
                          <p className="text-sm font-medium text-slate-500">{deviceName} Monitoring System</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-mono">Generated: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                          <p className="text-sm font-bold text-slate-800">{periodLabel} Report</p>
                        </div>
                      </div>

                      {/* INFO */}
                      <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-400 uppercase">Periode Laporan</p>
                          <p className="text-lg font-bold text-slate-800 flex items-center gap-2"><Calendar size={18} className="text-blue-600" />{periodLabel}</p>
                          <p className="text-sm text-slate-600">{format(reportData.dateRange.start, 'dd MMMM yyyy')} — {format(reportData.dateRange.end, 'dd MMMM yyyy')}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase">Lokasi & Standar</p>
                          <p className="text-lg font-bold text-slate-800">{deviceName}</p>
                          <p className="text-sm text-slate-600">Suhu: {standards.labelTemp} | Kelembaban: {standards.labelHum}</p>
                        </div>
                      </div>

                      {/* METRICS */}
                      <div className="mb-8">
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Executive Summary</h3>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 rounded border border-slate-100">
                               <div className="flex items-center gap-2 mb-1">
                                 <Thermometer size={14} className="text-red-500" />
                                 <span className="text-xs font-bold text-slate-600 uppercase">Avg Temp</span>
                               </div>
                               <p className="text-xl font-black text-slate-800">{reportData.avgTemp.toFixed(1)}°C</p>
                               <p className="text-[10px] text-slate-400 font-mono">Std: {standards.labelTemp}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded border border-slate-100">
                               <div className="flex items-center gap-2 mb-1">
                                 <Droplets size={14} className="text-blue-500" />
                                 <span className="text-xs font-bold text-slate-600 uppercase">Avg Hum</span>
                               </div>
                               <p className="text-xl font-black text-slate-800">{reportData.avgHum.toFixed(1)}%</p>
                               <p className="text-[10px] text-slate-400 font-mono">Std: {standards.labelHum}</p>
                            </div>
                         </div>
                         <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-100">
                           <div className="flex items-center gap-2 mb-1">
                             <AlertTriangle size={14} className="text-amber-500" />
                             <span className="text-xs font-bold text-slate-600 uppercase">Total Incidents</span>
                           </div>
                           <p className={`text-xl font-black ${reportData.incidentCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                             {reportData.incidentCount}
                           </p>
                         </div>
                      </div>

                      {/* CHARTS */}
                      <div className="mb-8">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Environmental Trends</h3>
                        <div className="grid grid-cols-2 gap-8">
                           <div>
                             <p className="text-xs font-bold text-center mb-2 text-slate-600">Temperature Fluctuation (°C)</p>
                             <ReportChart 
                               data={reportData.history} 
                               type="temp" 
                               standards={standards}
                             />
                           </div>
                           <div>
                             <p className="text-xs font-bold text-center mb-2 text-slate-600">Humidity Fluctuation (%)</p>
                             <ReportChart 
                               data={reportData.history} 
                               type="hum" 
                               standards={standards}
                             />
                           </div>
                        </div>
                      </div>

                      {/* UNIFIED LOGS TABLE */}
                      <div className="mb-8">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex justify-between">
                           <span>Detailed System Log</span>
                           <span className="normal-case font-normal text-[10px] bg-slate-100 px-2 rounded text-slate-500 flex items-center gap-2">
                             Filters: {logTypeFilter !== 'ALL' ? logTypeFilter : 'All Types'} • Sensors: {selectedSensors.length === 4 ? 'All' : selectedSensors.join(', ')}
                           </span>
                        </h3>
                        
                        <div className="border border-slate-200 rounded overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-2 w-24">Time</th>
                                <th className="p-2 w-20">Type</th>
                                <th className="p-2 w-20">Sensor</th>
                                <th className="p-2 w-20">Value</th>
                                <th className="p-2">Details / Message</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredLogs.length === 0 ? (
                                <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">No logs found matching current filters.</td></tr>
                              ) : (
                                filteredLogs.map((item: CombinedLogItem, idx: number) => {
                                  if (item.type === 'INCIDENT') {
                                    const inc = item.data as ReportIncident;
                                    return (
                                      <tr key={`inc-${idx}`} className="bg-red-50/30">
                                        <td className="p-2 text-slate-600 font-mono">{format(parseISO(inc.time), 'HH:mm')}</td>
                                        <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">INCIDENT</span></td>
                                        <td className="p-2 font-bold">{inc.sensor}</td>
                                        <td className="p-2 font-bold text-red-600">{inc.value}</td>
                                        <td className="p-2 text-slate-700 flex items-center gap-1">
                                          <AlertCircle size={12} className="text-red-500" />
                                          {inc.description}
                                        </td>
                                      </tr>
                                    );
                                  } else {
                                    const stat = item.data as ReportHourlyStat;
                                    return (
                                      <tr key={`hour-${idx}`}>
                                        <td className="p-2 text-slate-500 font-mono">{format(parseISO(stat.time), 'HH:00')}</td>
                                        <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">HOURLY</span></td>
                                        <td className="p-2 text-slate-400 text-[10px]">ENV</td>
                                        <td className="p-2 font-mono text-slate-600">
                                          {selectedSensors.includes('TEMP') && <span className="mr-2">T:{stat.avgTemp.toFixed(1)}</span>}
                                          {selectedSensors.includes('HUM') && <span className="mr-2">H:{stat.avgHum.toFixed(1)}</span>}
                                        </td>
                                        <td className="p-2 text-slate-500 italic text-[10px]">Hourly average reading</td>
                                      </tr>
                                    );
                                  }
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* CONCLUSION */}
                      <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                        <h3 className="text-xs font-bold text-slate-600 uppercase mb-2">Conclusion</h3>
                        <p className="text-sm text-slate-700 leading-relaxed">{reportData.conclusion}</p>
                      </div>

                      {/* APPROVAL FOOTER */}
                      <div className="mt-12 pt-6 border-t-2 border-slate-200 flex justify-between text-xs text-slate-500">
                         <div className="w-1/3">
                            <p className="mb-8">Prepared By:</p>
                            <div className="border-b border-slate-300 w-3/4 mb-1"></div>
                            <p className="font-bold">System Administrator</p>
                         </div>
                         <div className="w-1/3 text-center">
                            <p className="italic">"Data integrity verified by Specto System"</p>
                         </div>
                         <div className="w-1/3 text-right">
                            <p className="mb-8">Approved By:</p>
                            <div className="border-b border-slate-300 w-3/4 ml-auto mb-1"></div>
                            <p className="font-bold">MSDC Manager</p>
                         </div>
                      </div>
                    </>
                  ) : null}
               </div>
            </div>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="p-4 border-t border-specto-border-light dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={handlePrint} className="px-4 py-2 rounded-lg text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition flex items-center gap-2"><Printer size={16}/> Print</button>
          <button onClick={handleGeneratePDF} disabled={isGenerating} className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 flex gap-2 items-center shadow-lg shadow-blue-500/30">
            {isGenerating ? <RefreshCw className="animate-spin h-4 w-4"/> : <Download size={16}/>}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportDialog;