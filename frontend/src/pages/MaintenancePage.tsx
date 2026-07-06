import React, { useState, useEffect } from 'react';
import { Download, Plus, CheckCircle, XCircle, Clock, Calendar, FileCheck, Save, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { apiClient } from '../api/apiClient'; // Pastikan path ini benar sesuai struktur project Anda

type CheckItemStatus = 'PASS' | 'FAIL' | 'PENDING';

interface CheckItem {
  id: string;
  name: string;
  description: string;
  status: CheckItemStatus;
  notes?: string;
}

interface MaintenanceRecord {
  id: number; // diubah dari string
  date: string;
  technician: string;
  items: CheckItem[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  completedAt?: string;
}

const DEFAULT_CHECK_ITEMS: Omit<CheckItem, 'status' | 'notes'>[] = [
  {
    id: 'temp-sensor',
    name: 'Temperature Sensor Calibration',
    description: 'Verify temperature sensor readings accuracy within ±0.5°C',
  },
  {
    id: 'humidity-sensor',
    name: 'Humidity Sensor Check',
    description: 'Check humidity sensor functionality and calibration range 0-100%',
  },
  {
    id: 'smoke-detector',
    name: 'Smoke Detector Test',
    description: 'Test smoke detector with test aerosol spray, verify alarm triggers',
  },
  {
    id: 'flame-sensor',
    name: 'Flame Sensor Test',
    description: 'Verify flame sensor detects artificial flame source',
  },
];

const MaintenancePage: React.FC = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [activeChecksheet, setActiveChecksheet] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTechnician, setNewTechnician] = useState('');
  const [isExporting, setIsExporting] = useState(false);


  // Fetch records dari backend
  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await apiClient.get('/api/maintenance/records');
      setRecords(res.data);
    } catch (err) {
      console.error('Failed to fetch maintenance records', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);




  const handleStartChecksheet = async () => {
    if (!newTechnician.trim()) return;

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const existingRecord = records.find((r) => r.date === dateStr);

    if (existingRecord) {
      setActiveChecksheet(existingRecord.id);
    } else {
      const newRecordData = {
        date: dateStr,
        technician: newTechnician.trim(),
        items: DEFAULT_CHECK_ITEMS.map((item) => ({ ...item, status: 'PENDING' })),
      };
      try {
        const res = await apiClient.post('/api/maintenance/records', newRecordData);
        const savedRecord = res.data;
        setRecords((prev) => [savedRecord, ...prev]);
        setActiveChecksheet(savedRecord.id);
      } catch (err) {
        console.error('Failed to create maintenance record', err);
        alert('Gagal membuat checksheet');
      }
    }

    setNewTechnician('');
    setShowNewForm(false);
  };

  const handleUpdateItemStatus = async (recordId: number, itemId: string, status: CheckItemStatus, notes: string = '') => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    const updatedItems = record.items.map(item =>
      item.id === itemId ? { ...item, status, notes } : item
    );
    try {
      const res = await apiClient.put(`/api/maintenance/records/${recordId}`, { items: updatedItems });
      setRecords(prev => prev.map(r => r.id === recordId ? res.data : r));
    } catch (err) {
      console.error('Failed to update item', err);
      alert('Gagal menyimpan perubahan');
    }
  };

  const handleSaveRecord = () => {
    setActiveChecksheet(null);
  };

  const handleExportPDF = async (recordId: number) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    setIsExporting(true);

    try {
      const reportContainer = document.createElement('div');
      reportContainer.id = 'temp-pdf-container';
      reportContainer.style.position = 'absolute';
      reportContainer.style.left = '-9999px';
      reportContainer.style.top = '0';
      reportContainer.style.width = '210mm'; 
      reportContainer.style.backgroundColor = '#ffffff';
      reportContainer.style.padding = '20mm';
      reportContainer.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
      reportContainer.style.color = '#1f2937';

      const statusColor = record.failedChecks > 0 ? '#dc2626' : '#16a34a';
      const statusText = record.failedChecks > 0 ? 'ATTENTION REQUIRED' : 'PASSED';
      
      reportContainer.innerHTML = `
        <div style="border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="font-size: 28px; font-weight: 900; color: #1e3a8a; margin: 0; letter-spacing: -0.5px;">SPECTO MAINTENANCE</h1>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0;">Server Room Monitoring & Maintenance System</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; color: #9ca3af; margin: 0;">REPORT ID</p>
            <p style="font-size: 14px; font-weight: bold; margin: 0;">${record.id}</p>
          </div>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 30px; background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="flex: 1;">
            <p style="font-size: 10px; color: #6b7280; margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">Date</p>
            <p style="font-size: 14px; font-weight: 600; margin: 0;">${new Date(record.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div style="flex: 1;">
            <p style="font-size: 10px; color: #6b7280; margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">Technician</p>
            <p style="font-size: 14px; font-weight: 600; margin: 0;">${record.technician}</p>
          </div>
          <div style="flex: 1;">
             <p style="font-size: 10px; color: #6b7280; margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">Completion</p>
             <p style="font-size: 14px; font-weight: 600; margin: 0;">${record.completedAt ? new Date(record.completedAt).toLocaleTimeString('id-ID') : 'In Progress'}</p>
          </div>
          <div style="flex: 1; text-align: right;">
            <p style="font-size: 10px; color: #6b7280; margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">Overall Result</p>
            <span style="background-color: ${statusColor}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold;">${statusText}</span>
          </div>
        </div>

        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; color: #1f2937;">Checklist Items</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f3f4f6; color: #4b5563;">
              <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Task Name</th>
              <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb; width: 40%;">Description</th>
              <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">Status</th>
              <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${record.items.map((item, index) => `
              <tr style="border-bottom: 1px solid #e5e7eb; background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 12px 10px; font-weight: 600;">${item.name}</td>
                <td style="padding: 12px 10px; color: #6b7280;">${item.description}</td>
                <td style="padding: 12px 10px; text-align: center;">
                  <span style="
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 9999px;
                    font-size: 10px;
                    font-weight: bold;
                    color: ${item.status === 'PASS' ? '#065f46' : item.status === 'FAIL' ? '#991b1b' : '#92400e'};
                    background-color: ${item.status === 'PASS' ? '#d1fae5' : item.status === 'FAIL' ? '#fee2e2' : '#fef3c7'};
                  ">
                    ${item.status}
                  </span>
                </td>
                <td style="padding: 12px 10px; color: ${item.notes ? '#374151' : '#d1d5db'}; font-style: ${item.notes ? 'normal' : 'italic'};">
                  ${item.notes || 'No notes provided'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
           <div style="width: 45%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
              <p style="font-size: 12px; font-weight: bold; margin-bottom: 40px;">Technician Signature</p>
              <div style="border-bottom: 1px solid #d1d5db; margin-bottom: 5px;"></div>
              <p style="font-size: 12px; color: #4b5563;">${record.technician}</p>
           </div>
           <div style="width: 45%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
              <p style="font-size: 12px; font-weight: bold; margin-bottom: 40px;">Supervisor Approval</p>
              <div style="border-bottom: 1px solid #d1d5db; margin-bottom: 5px;"></div>
              <p style="font-size: 12px; color: #4b5563;">( Signed by Supervisor )</p>
           </div>
        </div>

        <div style="margin-top: 50px; font-size: 10px; text-align: center; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          Generated automatically by Specto System on ${new Date().toLocaleString('id-ID')}
        </div>
      `;

      document.body.appendChild(reportContainer);

      const canvas = await html2canvas(reportContainer, { 
        scale: 2, 
        useCORS: true,
        logging: false 
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

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

      pdf.save(`Maintenance_Report_${record.date}.pdf`);
      document.body.removeChild(reportContainer);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const activeRecord = records.find((r) => r.id === activeChecksheet);

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl shadow-xl p-6 text-white flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Calendar size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Maintenance Management</h1>
          </div>
        </div>

      </div>


      {/* Active Checksheet Section */}
      {activeRecord && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-400 rounded-lg">
                    <FileCheck size={20} className="text-white" />
                  </div>
                  Active Checksheet
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1 ml-10">
                  Technician: <span className="font-semibold text-gray-900 dark:text-white">{activeRecord.technician}</span> • 
                  Date: <span className="font-semibold text-gray-900 dark:text-white">
                    {new Date(activeRecord.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </p>
              </div>
              <div className="flex gap-2 mt-4 md:mt-0">
                <button
                  onClick={() => handleExportPDF(activeRecord.id)}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  {isExporting ? 'Generating...' : 'Export PDF'}
                </button>
                <button
                  onClick={() => setActiveChecksheet(null)}
                  className="px-4 py-2.5 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-semibold transition-all duration-300"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Progress Stats */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/5 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Passed</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{activeRecord.passedChecks}</p>
                  </div>
                  <CheckCircle className="text-emerald-500" size={24} />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-red-500/10 to-orange-500/5 p-4 rounded-xl border border-red-200 dark:border-red-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Failed</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">{activeRecord.failedChecks}</p>
                  </div>
                  <XCircle className="text-red-500" size={24} />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/5 p-4 rounded-xl border border-blue-200 dark:border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Progress</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {((activeRecord.passedChecks / activeRecord.totalChecks) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-700 rounded-full"></div>
                    <div 
                      className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
                      style={{
                        borderTopColor: 'transparent',
                        borderRightColor: '#3b82f6',
                        borderBottomColor: '#3b82f6',
                        borderLeftColor: '#3b82f6',
                        transform: `rotate(${(activeRecord.passedChecks / activeRecord.totalChecks) * 360}deg)`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Check Items */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRecord.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-all duration-300 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${
                      item.status === 'PASS' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                      item.status === 'FAIL' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                      'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    }`}>
                      {item.status === 'PASS' ? <CheckCircle size={18} /> :
                       item.status === 'FAIL' ? <XCircle size={18} /> :
                       <Clock size={18} />}
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() =>
                        handleUpdateItemStatus(activeRecord.id, item.id, 'PASS')
                      }
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                        item.status === 'PASS'
                          ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-emerald-900/30'
                      }`}
                    >
                      <CheckCircle size={16} />
                      Pass
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateItemStatus(activeRecord.id, item.id, 'FAIL')
                      }
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                        item.status === 'FAIL'
                          ? 'bg-gradient-to-r from-red-500 to-orange-400 text-white shadow-lg shadow-red-500/25'
                          : 'bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30'
                      }`}
                    >
                      <XCircle size={16} />
                      Fail
                    </button>
                  </div>

                  {item.status !== 'PENDING' && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) =>
                          handleUpdateItemStatus(
                            activeRecord.id,
                            item.id,
                            item.status,
                            e.target.value,
                          )
                        }
                        placeholder="Add notes (optional)"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Save Button Footer */}
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={handleSaveRecord}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-1"
              >
                <Save size={20} />
                Save & Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start New Checksheet Section */}
      {!activeChecksheet && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl flex items-center justify-center gap-3 text-lg font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              <Plus size={24} />
              Start New Monthly Maintenance Checksheet
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Technician Name
                </label>
                <input
                  type="text"
                  value={newTechnician}
                  onChange={(e) => setNewTechnician(e.target.value)}
                  placeholder="Enter technician name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleStartChecksheet()}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleStartChecksheet}
                  disabled={!newTechnician.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-600 hover:to-green-500 text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Checksheet
                </button>
                <button
                  onClick={() => {
                    setShowNewForm(false);
                    setNewTechnician('');
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-semibold transition-all duration-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maintenance History */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar size={20} />
            Maintenance History
            {loadingRecords && <Loader2 className="animate-spin ml-2" size={16} />}
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-700/50">
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Technician
                </th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Results
                </th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {records.map((record) => (
                <tr 
                  key={record.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors duration-200 cursor-pointer"
                  onClick={() => setActiveChecksheet(record.id)}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg mr-3">
                        <Calendar size={16} className="text-blue-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {new Date(record.date).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {record.completedAt ? 'Completed' : 'In Progress'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {record.technician}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      record.completedAt
                        ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-700 dark:text-amber-300'
                    }`}>
                      {record.completedAt ? 'Completed' : 'In Progress'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {record.passedChecks}
                      </span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {record.totalChecks}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({((record.passedChecks / record.totalChecks) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportPDF(record.id);
                      }}
                      disabled={isExporting}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-500/10 to-gray-600/10 hover:from-gray-600/20 hover:to-gray-700/20 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      Export
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;