/** `GET /api/v1/admin/settings` (normalised; unset sections fall back to empty values). */
export interface AdminSettings {
  organization: { name: string; tagline: string; email: string; phone: string; address: string; city: string; state: string; pincode: string };
  app: { maintenance: boolean; registration: boolean; kycRequired: boolean; showPrices: boolean; virtualTours: boolean; stagePayment: boolean; interior: boolean };
  sla: { interiorHours: number; stagePaymentHours: number; enquiryHours: number; autoEscalate: boolean; escalateToAdminId: string | null; escalateToName: string };
  alerts: { triggers: Record<string, boolean>; email: string; whatsapp: string };
  notifications: {
    contact: { phone: string; email: string; ccEmail: string };
    email: Record<string, boolean>;
    whatsapp: Record<string, boolean>;
  };
  display: { timezone: string; dateFormat: string; currencyFormat: 'indian' | 'international' | string };
  tools: SettingsTools;
  updatedAt: string | null;
}

export interface BoostPlan {
  id: string;
  name: string;
  priceLabel: string;
  description: string;
  benefits: string[];
  active: boolean;
}

export interface InteriorPackage {
  id: string;
  name: string;
  priceRange: string;
  timeline: string;
  active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discount: string;
  type: '% discount' | 'Flat discount';
  appliesTo: string;
  uses: string;
  expiry: string;
  active: boolean;
}

export interface SettingsTools {
  boostPlans: BoostPlan[];
  interiorPackages: InteriorPackage[];
  coupons: Coupon[];
}

/** PATCH /api/v1/admin/settings body (updateValidator). */
export interface AdminSettingsPatch {
  organization?: Partial<AdminSettings['organization']>;
  app?: Partial<AdminSettings['app']>;
  sla?: Partial<AdminSettings['sla']>;
  alerts?: { triggers?: Record<string, boolean>; email?: string; whatsapp?: string };
  notifications?: { contact?: Partial<AdminSettings['notifications']['contact']>; email?: Record<string, boolean>; whatsapp?: Record<string, boolean> };
  tools?: Partial<SettingsTools>;
  display?: { timezone?: 'IST' | 'GST' | 'SGT' | 'GMT' | 'EST' | 'PST'; dateFormat?: 'DD MMM YYYY' | 'DD/MM/YYYY' | 'MMM DD, YYYY' | 'YYYY-MM-DD'; currencyFormat?: 'indian' | 'international' };
}
