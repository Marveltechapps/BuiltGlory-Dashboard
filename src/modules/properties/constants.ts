import type { Property } from '../../types/properties';

export const PROPERTY_TAB: Record<string, 'all' | 'add' | 'upload' | 'featured' | 'upcoming' | 'templates'> = {
  '/admin/properties/all': 'all',
  '/admin/properties/add': 'add',
  '/admin/properties/upload': 'upload',
  '/admin/properties/featured': 'featured',
  '/admin/properties/upcoming': 'upcoming',
  '/admin/properties/templates': 'templates',
};

export const FILTER_TYPES: Array<[string, string]> = [
  ['plot', 'Plot'], ['apartment', 'Apartment'], ['residential', 'Residential'], ['commercial', 'Commercial'], ['organic_home', 'Organic Home'],
  ['3d_printing', '3D Printing'], ['fractional', 'Fractional'], ['ceo_mansion', 'CEO Mansion'], ['holiday_home', 'Holiday Home'], ['land', 'Land'],
  ['farmhouse', 'Farmhouse'], ['nri', 'NRI'], ['interior', 'Interior'], ['villa', 'Villa'],
];

/** Display statuses. "paused" is not a backend status: it is an available listing hidden from the app (isVisibleOnApp=false). */
export const PROPERTY_STATUS: Record<string, [string, string]> = {
  available: ['Available', 'green'], paused: ['Paused', 'slate'], sold: ['Sold', 'muted'], reserved: ['Reserved', 'blue'],
  under_construction: ['Under Construction', 'orange'], draft: ['Draft', 'amber'],
};

export const displayStatus = (p: Pick<Property, 'status' | 'isVisibleOnApp'>) => (p.status === 'available' && !p.isVisibleOnApp ? 'paused' : p.status);

/** Live on the app: available, visible and has at least one photo. */
export const isOnApp = (p: Property) => p.status === 'available' && p.isVisibleOnApp && p.photos.length > 0;

const YN = ['Yes', 'No'];

/** [label, options, required, placeholder, specs key] — specs keys follow the bulk template spec headers. */
export type SpecDef = string | [string, string[] | null, boolean?, string?];

export const SPECS: Record<string, SpecDef[]> = {
  apartment: [['Property Sub-Type', ['Standalone', 'Gated Community', 'High-rise']], 'Builder Name', 'Tower Name', 'Unit Number', ['BHK Type', ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK']], 'Super Built-up Area (sqft)', 'Built-up Area (sqft)', 'Carpet Area (sqft)', 'UDS (sqft)', 'Bedrooms', 'Bathrooms', 'Balcony count', 'Floor Number', 'Total Floors', 'Flats on Floor', ['Facing', ['North', 'East', 'West', 'South', 'North-East', 'North-West', 'South-East', 'South-West']], ['Vastu Compliant', YN], 'Age of Property', ['Furnishing', ['Unfurnished', 'Semi-furnished', 'Fully furnished']], ['Parking Type', ['Covered', 'Open', 'Stilt', 'None']], 'Parking Slots', ['OC/CC Status', ['Received', 'Applied', 'Not applicable']], 'RERA Number'],
  plot: ['Layout Name', 'Total Plots in Layout', 'Plot Number', ['Plot Area (sqft)', null, true], ['Plot Dimension (L×W)', null, false, 'e.g. 30×40'], ['Facing Direction', ['North', 'East', 'West', 'South']], 'Road Width (ft)', ['Approval Type', ['CMDA', 'DTCP', 'BDA', 'BMRDA', 'Panchayat']], ['Corner Plot', YN], ['Loan Approved', YN], ['Title Type', ['Clear title', 'Patta', 'Sale deed']], ['Patta Available', YN], ['Boundary Marked', YN]],
  commercial: [['Suitable For', ['Retail', 'Office', 'Warehouse', 'Restaurant', 'Showroom']], 'Frontage Width', 'Ceiling Height', ['Power Load', null, false, 'e.g. 10kW / 3-phase'], 'Washrooms', 'Lift Count'],
  ceo_mansion: [['Private Pool', YN], ['Home Theatre', YN], ['Staff Quarters', YN], ['Smart Home', YN]],
  holiday_home: ['Distance from Beach/Hills', 'Nearest City', 'Rental Yield %'],
  farmhouse: ['Land Area (acres)', ['Borewell', YN], ['Farm Land', YN], 'Fruit Trees', 'Distance from City (km)'],
  organic_home: [['Solar Panels', YN], ['Rainwater Harvesting', YN], ['Organic Garden', YN], ['Compost Pit', YN], ['Natural Ventilation', YN]],
  '3d_printing': ['Print Technology', 'Estimated Completion', 'Structural Warranty'],
  fractional: ['Total Property Value (₹)', ['Fraction Size %', null, false, 'e.g. 10%'], 'Min Investment (₹)', 'Expected Returns %', 'Lock-in Period (months)', 'Property Manager'],
  land: ['Total Area', 'Survey Number', ['Zone Type', ['Residential', 'Agricultural', 'Commercial', 'Industrial']], ['Road Access', YN], 'Water Source'],
  nri: [['Property Type', ['Apartment', 'Villa', 'Plot']], ['NRI Friendly', YN], ['FEMA Compliant', YN], ['Power of Attorney', YN], ['NRI Loan Available', YN]],
  interior: ['Room/Area', ['Style', ['Modern', 'Contemporary', 'Minimalist', 'Classic']], ['Budget Range', ['Budget', 'Standard', 'Premium', 'Luxury']], 'Timeline (weeks)'],
};

/** Reference spec labels → backend `specs` keys (bulk-template spec headers). Unlisted labels use a camelCase key. */
const SPEC_KEYS: Record<string, string> = {
  'Property Sub-Type': 'subType', 'Builder Name': 'builderName', 'Tower Name': 'towerName', 'Unit Number': 'unitNumber', 'BHK Type': 'bhk',
  'Super Built-up Area (sqft)': 'superBuiltUp', 'Built-up Area (sqft)': 'builtUpArea', 'Carpet Area (sqft)': 'carpetArea', 'UDS (sqft)': 'uds',
  Bedrooms: 'bedrooms', Bathrooms: 'bathrooms', 'Balcony count': 'balcony', 'Floor Number': 'floorNumber', 'Total Floors': 'totalFloors',
  'Flats on Floor': 'flatsOnFloor', Facing: 'facing', 'Vastu Compliant': 'vastuCompliant', 'Age of Property': 'age', Furnishing: 'furnishing',
  'Parking Type': 'parkingType', 'Parking Slots': 'parkingSlots', 'OC/CC Status': 'ocStatus', 'RERA Number': 'reraNumber',
  'Layout Name': 'layoutName', 'Total Plots in Layout': 'totalPlotsInLayout', 'Plot Number': 'plotNumber', 'Plot Area (sqft)': 'plotArea',
  'Plot Dimension (L×W)': 'plotDimension', 'Facing Direction': 'facing', 'Road Width (ft)': 'roadWidth', 'Approval Type': 'approvalType',
  'Corner Plot': 'cornerPlot', 'Loan Approved': 'loanApproved', 'Title Type': 'titleType', 'Patta Available': 'pattaAvailable', 'Boundary Marked': 'boundaryMarked',
  'Suitable For': 'suitableFor', 'Frontage Width': 'frontageWidth', 'Ceiling Height': 'ceilingHeight', 'Power Load': 'powerLoad', Washrooms: 'washrooms',
  'Lift Count': 'liftCount', 'Private Pool': 'privatePool', 'Home Theatre': 'homeTheatre', 'Staff Quarters': 'staffQuarters', 'Smart Home': 'smartHome',
  'Distance from Beach/Hills': 'distanceBeachHills', 'Nearest City': 'nearestCity', 'Rental Yield %': 'rentalYield', 'Land Area (acres)': 'landAreaAcres',
  Borewell: 'borewell', 'Farm Land': 'farmLand', 'Fruit Trees': 'fruitTrees', 'Distance from City (km)': 'distanceFromCity', 'Solar Panels': 'solarPanels',
  'Rainwater Harvesting': 'rainwaterHarvesting', 'Organic Garden': 'organicGarden', 'Compost Pit': 'compostPit', 'Natural Ventilation': 'ventilationType',
  'Print Technology': 'printTechnology', 'Estimated Completion': 'estimatedCompletion', 'Structural Warranty': 'structuralWarranty',
  'Total Property Value (₹)': 'totalPropertyValue', 'Fraction Size %': 'fractionSize', 'Min Investment (₹)': 'minInvestment', 'Expected Returns %': 'expectedReturns',
  'Lock-in Period (months)': 'lockInPeriod', 'Property Manager': 'propertyManager', 'Total Area': 'totalArea', 'Survey Number': 'surveyNumber',
  'Zone Type': 'landType', 'Road Access': 'roadAccess', 'Water Source': 'waterSource', 'Property Type': 'nriPropertyType', 'NRI Friendly': 'nriFriendly',
  'FEMA Compliant': 'femaCompliant', 'Power of Attorney': 'powerOfAttorney', 'NRI Loan Available': 'nriLoanAvailable', 'Room/Area': 'roomArea',
  Style: 'designStyle', 'Budget Range': 'budgetRange', 'Timeline (weeks)': 'timelineWeeks',
};

const camel = (s: string) => s.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toLowerCase());
export const specKey = (label: string) => SPEC_KEYS[label] || camel(label);
export const specParts = (d: SpecDef) => (Array.isArray(d) ? d : [d, null, false, '']) as [string, string[] | null, boolean | undefined, string | undefined];

export const AMENITIES = ['Swimming Pool', 'Gym', 'Clubhouse', 'Power Backup', 'Lift', 'Security', 'CCTV', 'Children’s Play Area', 'Garden', 'Covered Parking', 'Rainwater Harvesting', 'EV Charging'];

/** Master-sheet tabs (one per property type). */
export const SHEETS = ['Plot', 'Apartment', 'Residential', 'Commercial', 'Organic Home', '3D Printing Home', 'Fractional Ownership', 'CEO Mansion', 'Holiday Home', 'Land & Landbank', 'Farm House', 'NRI Services', 'Interior'];
export const SHEET_TYPE: Record<string, string> = {
  Plot: 'plot', Apartment: 'apartment', Residential: 'residential', Commercial: 'commercial', 'Organic Home': 'organic_home', '3D Printing Home': '3d_printing',
  'Fractional Ownership': 'fractional', 'CEO Mansion': 'ceo_mansion', 'Holiday Home': 'holiday_home', 'Land & Landbank': 'land', 'Farm House': 'farmhouse',
  'NRI Services': 'nri', Interior: 'interior',
};

/** Required columns for a master-sheet row (same rules the template grid validates before saving). */
export const BULK_REQUIRED = ['title', 'type', 'city', 'locality', 'pincode', 'price'];

/** Area shown in tables/cards: built-up, carpet or plot area from specs. */
export function areaOf(p: Property): number | null {
  const s = p.specs;
  const v = Number(s.builtUpArea ?? s.carpetArea ?? s.plotArea ?? s.superBuiltUp ?? 0);
  return v > 0 ? v : null;
}

export function bhkOf(p: Property): string {
  const v = String(p.specs.bhk ?? '').trim();
  if (!v) return '';
  return /bhk/i.test(v) ? v : v + ' BHK';
}

export const reraOf = (p: Property) => String(p.specs.reraNumber ?? '') || '';
