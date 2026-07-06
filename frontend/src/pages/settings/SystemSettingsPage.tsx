import React, { useEffect, useState } from 'react';
import {
  SlidersHorizontal, Thermometer, Flame, CloudFog,
  Save, Loader2, BellRing, Send, ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';

interface Thresholds {
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  smoke_max: number;
  flame_min: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  temp_min: 18, temp_max: 27, hum_min: 20, hum_max: 80, smoke_max: 4000, flame_min: 200,
};

// Nilai "aktif" (deteksi normal) vs "nonaktif" (sentinel yang tidak pernah tercapai).
const SMOKE_ON = 4000, SMOKE_OFF = 100000; // ADC maks 4095 -> 100000 = tidak pernah bahaya
const FLAME_ON = 200, FLAME_OFF = -1;      // flame 0..4095 -> -1 = tidak pernah bahaya

const NumberField: React.FC<{
  label: string;
  value: number;
  unit?: string;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, unit, step = 1, onChange }) => (
  <div>
    <label className="block mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
      />
      {unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">{unit}</span>}
    </div>
  </div>
);

const ToggleRow: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}> = ({ icon: Icon, label, desc, checked, onChange }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${checked ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-200 text-gray-400 dark:bg-gray-600'}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="font-semibold text-gray-800 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc} — {checked ? 'Aktif (mendeteksi)' : 'Nonaktif'}</p>
      </div>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
    </label>
  </div>
);

const SystemSettingsPage: React.FC = () => {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [savingThresholds, setSavingThresholds] = useState(false);

  const [reminderDay, setReminderDay] = useState(15);
  const [reminderTime, setReminderTime] = useState('07:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    apiClient
      .get('/api/settings/thresholds')
      .then((res) => {
        const d = res.data;
        setThresholds({
          temp_min: d.temp_min, temp_max: d.temp_max,
          hum_min: d.hum_min, hum_max: d.hum_max,
          smoke_max: d.smoke_max, flame_min: d.flame_min,
        });
      })
      .catch(() => {});

    apiClient
      .get('/api/maintenance/settings')
      .then((res) => {
        if (!res.data) return;
        setReminderDay(res.data.reminder_day);
        setReminderTime(res.data.reminder_time || '07:00');
        setReminderEnabled(res.data.is_enabled);
      })
      .catch(() => {});
  }, []);

  const setField = (key: keyof Thresholds, value: number) =>
    setThresholds((prev) => ({ ...prev, [key]: value }));

  const smokeEnabled = thresholds.smoke_max <= 4095;
  const flameEnabled = thresholds.flame_min >= 0;

  const saveThresholds = async () => {
    const t = thresholds;
    if (Object.values(t).some((v) => !Number.isFinite(v))) {
      alert('Semua nilai harus diisi dengan angka yang valid.');
      return;
    }
    if (t.temp_min >= t.temp_max || t.hum_min >= t.hum_max) {
      alert('Nilai minimum harus lebih kecil dari nilai maksimum.');
      return;
    }
    setSavingThresholds(true);
    try {
      await apiClient.put('/api/settings/thresholds', t);
      alert('Standar sensor tersimpan. Perangkat IoT akan menyesuaikan otomatis (tanpa reflash).');
    } catch {
      alert('Gagal menyimpan standar sensor.');
    } finally {
      setSavingThresholds(false);
    }
  };

  const saveReminder = async () => {
    setSavingReminder(true);
    try {
      await apiClient.put('/api/maintenance/settings', {
        day: reminderDay, time: reminderTime, enabled: reminderEnabled,
      });
      alert('Jadwal maintenance berhasil diperbarui!');
    } catch {
      alert('Gagal menyimpan pengaturan.');
    } finally {
      setSavingReminder(false);
    }
  };

  const sendTestReminder = async () => {
    setSendingTest(true);
    try {
      await apiClient.post('/api/maintenance/test-reminder');
      alert('Email pengingat percobaan telah dikirim ke semua Admin.');
    } catch {
      alert('Gagal mengirim email percobaan. Pastikan backend terhubung.');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <SlidersHorizontal size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">System Settings</h1>
            <p className="text-slate-400 text-sm">Standar sensor & jadwal pengingat maintenance</p>
          </div>
        </div>
      </div>

      {/* Sensor Thresholds */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-500" /> Sensor Thresholds
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Nilai ini dipakai aplikasi & dikirim otomatis ke perangkat ESP32.
          </p>
        </div>

        <div className="p-6 space-y-8">
          {/* Environment */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Thermometer size={16} className="text-red-500" /> Environment Standards
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <NumberField label="Temp Min" unit="°C" step={0.5} value={thresholds.temp_min} onChange={(v) => setField('temp_min', v)} />
              <NumberField label="Temp Max" unit="°C" step={0.5} value={thresholds.temp_max} onChange={(v) => setField('temp_max', v)} />
              <NumberField label="Humidity Min" unit="%" step={1} value={thresholds.hum_min} onChange={(v) => setField('hum_min', v)} />
              <NumberField label="Humidity Max" unit="%" step={1} value={thresholds.hum_max} onChange={(v) => setField('hum_max', v)} />
            </div>
          </div>

          {/* Safety Detection (Smoke & Flame) */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Flame size={16} className="text-orange-500" /> Safety Detection
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Aktifkan atau nonaktifkan deteksi asap &amp; api. Saat nonaktif, sensor tidak akan memicu alarm.
            </p>
            <div className="space-y-3">
              <ToggleRow icon={CloudFog} label="Smoke Detection" desc="Sensor asap (MQ-2)" checked={smokeEnabled} onChange={(on) => setField('smoke_max', on ? SMOKE_ON : SMOKE_OFF)} />
              <ToggleRow icon={Flame} label="Flame Detection" desc="Sensor api" checked={flameEnabled} onChange={(on) => setField('flame_min', on ? FLAME_ON : FLAME_OFF)} />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={saveThresholds}
              disabled={savingThresholds}
              className="px-8 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-white shadow-lg transition-all bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {savingThresholds ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Thresholds
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Reminder */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BellRing size={20} className="text-emerald-500" /> Maintenance Reminder
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Jadwal pengingat maintenance bulanan (email &amp; WhatsApp ke Admin).</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">Email &amp; WhatsApp Notification</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aktifkan pengiriman pengingat otomatis</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Monthly Schedule Date</label>
              <div className="relative">
                <select
                  value={reminderDay}
                  onChange={(e) => setReminderDay(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {[...Array(28)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Every {i + 1}th of the month</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Reminder Time</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
            ℹ️ Jika tanggal {reminderDay} jatuh pada akhir pekan, pengingat otomatis dikirim Senin berikutnya pukul <strong>{reminderTime}</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={sendTestReminder}
              disabled={sendingTest}
              className="flex-1 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20 font-bold flex justify-center items-center gap-2 transition-all disabled:opacity-50"
            >
              {sendingTest ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              Send Test Reminder
            </button>
            <button
              onClick={saveReminder}
              disabled={savingReminder}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/30 flex justify-center items-center gap-2 transition-all disabled:opacity-50"
            >
              {savingReminder ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsPage;
