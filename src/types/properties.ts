export type PropertyStatus = 'available' | 'sold' | 'reserved' | 'under_construction' | 'draft' | string;

/** `GET /api/v1/admin/properties[/:propertyId]` (normalised) */
export interface Property {
  id: string;
  referenceId: string;
  title: string;
  description: string;
  type: string;
  status: PropertyStatus;
  source: string;
  isFeatured: boolean;
  isUpcoming: boolean;
  isVisibleOnApp: boolean;
  addressLine: string;
  line1: string;
  line2: string;
  landmark: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  price: number;
  isNegotiable: boolean;
  specs: Record<string, unknown>;
  amenities: string[];
  photos: string[];
  coverPhoto: string | null;
  videoUrl: string | null;
  tour3dUrl: string | null;
  floorPlanUrl: string | null;
  droneImageUrl: string | null;
  droneVideoUrl: string | null;
  /** Raw media object — PATCH /admin/properties/:id replaces media, so edits merge into this. */
  media: Record<string, unknown>;
  highlights: string[];
  advantages: PropertyAdvantages | null;
  nearbyPlaces: NearbyPlace[];
  savedByUsers: string[];
  sourceSheet: string | null;
  views: number;
  enquiries: number;
  visits: number;
  saves: number;
  compareCount: number;
  assignedTo: string | null;
  acquisitionId: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  launchDate: string | null;
  possessionDate: string | null;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyAdvantages {
  investment: string[];
  location: string[];
  connectivity: string[];
}

export interface NearbyPlace {
  name: string;
  type: string;
  distance: string;
}

export interface PropertyPayload {
  title?: string;
  description?: string | null;
  type?: string;
  status?: 'available' | 'sold' | 'reserved' | 'under_construction' | 'draft';
  source?: 'acquired' | 'manual' | 'bulk_upload';
  isFeatured?: boolean;
  isUpcoming?: boolean;
  isVisibleOnApp?: boolean;
  address?: { line1?: string | null; line2?: string | null; locality?: string | null; city?: string | null; state?: string | null; pincode?: string | null; landmark?: string | null; latitude?: number; longitude?: number };
  price?: number;
  isNegotiable?: boolean;
  specs?: Record<string, unknown>;
  amenities?: string[];
  media?: Record<string, unknown>;
  highlights?: string[];
  advantages?: PropertyAdvantages;
  nearbyPlaces?: NearbyPlace[];
  assignedTo?: string;
  launchDate?: string | null;
  possessionDate?: string | null;
}

export interface ImportJob {
  id: string;
  referenceId: string;
  fileName: string;
  status: string;
  rowsTotal: number;
  rowsAccepted: number;
  rowsRejected: number;
  errors: Array<{ row: number; field: string; message: string }>;
  importedProperties: Array<{ id: string; referenceId: string; title: string; status: string; isDeleted: boolean }>;
  createdAt: string;
  completedAt: string | null;
  revertedAt: string | null;
}

export interface TemplateField {
  key: string;
  label: string;
  required: boolean;
  editable: boolean;
  type: string;
}

export interface TemplateResult {
  mode: 'empty' | 'valued';
  fields: TemplateField[];
  rows: Array<Record<string, string | number | boolean>>;
}
