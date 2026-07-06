import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subDays 
} from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportHistoryPoint {
  created_at: string;
  temperature: number;
  humidity: number;
}

export interface ReportIncident {
  id: number;
  time: string;
  severity: 'CRITICAL' | 'WARNING';
  sensor: 'TEMP' | 'HUM' | 'SMOKE' | 'FLAME';
  value: number;
  description: string;
}

export interface ReportHourlyStat {
  id: string;
  time: string;
  avgTemp: number;
  avgHum: number;
  sampleCount: number;
}

export interface ReportData {
  period: ReportPeriod;
  dateRange: { start: Date; end: Date };
  serverRoomStatus: {
    temperature: number;
    humidity: number;
    airflow: string;
    powerStatus: string;
  };
  metrics: {
    uptime: number;
    incidents: number;
    maintenancePerformed: number;
  };
  incidents: ReportIncident[];
  history: ReportHistoryPoint[];
  hourlyStats: ReportHourlyStat[];
  conclusion: string;
  deviceId?: string;
  standards?: { temp: string; hum: string };
}

// --- DATE HELPERS ---
export const getDateRange = (period: ReportPeriod): { start: Date; end: Date } => {
  const now = new Date();
  switch (period) {
    case 'daily':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'weekly':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'monthly':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom':
    default:
      return { start: subDays(now, 1), end: endOfDay(now) };
  }
};

// --- HELPER STANDAR ---
// Membangun standar laporan dari ambang batas (database). Fallback ke default bila kosong.
export interface ThresholdConfig {
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
}

export const getStandards = (t?: Partial<ThresholdConfig> | null) => {
  const tempMin = t?.temp_min ?? 18;
  const tempMax = t?.temp_max ?? 27;
  const humMin = t?.hum_min ?? 20;
  const humMax = t?.hum_max ?? 80;
  return {
    tempMin, tempMax, humMin, humMax,
    labelTemp: `${tempMin}-${tempMax}°C`,
    labelHum: `${humMin}-${humMax}%`,
  };
};

// --- REAL PDF GENERATOR FUNCTION ---
export const generateReportPDF = async (data: ReportData, elementId: string): Promise<void> => {
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error(`Element with ID '${elementId}' not found!`);
    alert("Gagal menemukan elemen laporan. Pastikan tampilan laporan sudah muncul.");
    return;
  }

  try {
    // 1. Capture HTML ke Canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Tingkatkan kualitas (Retina support)
      useCORS: true, 
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');

    // 2. Setup PDF (A4 Portrait)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // 3. Hitung rasio gambar agar pas di lebar A4
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // 4. Tambahkan gambar ke PDF
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    // 5. Simpan File
    const timestamp = new Date().toISOString().split('T')[0];
    const devName = data.deviceId || 'device';
    pdf.save(`Specto_Report_${devName}_${data.period}_${timestamp}.pdf`);

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Terjadi kesalahan saat membuat PDF. Coba lagi.');
  }
};