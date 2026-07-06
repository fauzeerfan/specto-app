// Tipe item checksheet maintenance (sebelumnya berada di maintenance-record.entity.ts).
export interface MaintenanceItem {
  id: string;
  name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  notes?: string;
}
