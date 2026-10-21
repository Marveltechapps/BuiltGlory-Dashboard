/** `GET /api/v1/admin/sales-team` and `GET /api/v1/admin/designers` → data[] */
export interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  assignedArea: string[];
  activeWorkload: number;
  isAvailable: boolean;
  specialization: string[];
}
