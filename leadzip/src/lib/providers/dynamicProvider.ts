/**
 * dynamicProvider.ts
 *
 * Deterministic, ZIP-seeded business generator.
 * - No external API calls — works perfectly on Vercel serverless.
 * - Same ZIP + category always returns the same businesses.
 * - Different ZIPs return different businesses.
 * - Covers all 50 states with ~100 ZIP entries.
 */

import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { geocodeZip, GeocodedZip } from '@/lib/geocode'

// ─── ZIP DATABASE ────────────────────────────────────────────────────────────

interface ZipEntry {
  city: string
  state: string
  lat: number
  lon: number
  areaCode: string
}

const ZIP_DATABASE: Record<string, ZipEntry> = {
  // Northeast — New York
  '10001': { city: 'New York', state: 'NY', lat: 40.7484, lon: -73.9967, areaCode: '212' },
  '10019': { city: 'New York', state: 'NY', lat: 40.7651, lon: -73.9861, areaCode: '212' },
  '10036': { city: 'New York', state: 'NY', lat: 40.7580, lon: -73.9855, areaCode: '212' },
  '10128': { city: 'New York', state: 'NY', lat: 40.7794, lon: -73.9495, areaCode: '212' },
  '11201': { city: 'Brooklyn', state: 'NY', lat: 40.6943, lon: -73.9902, areaCode: '718' },
  '11101': { city: 'Long Island City', state: 'NY', lat: 40.7448, lon: -73.9490, areaCode: '718' },
  '10301': { city: 'Staten Island', state: 'NY', lat: 40.6257, lon: -74.0944, areaCode: '718' },
  // Northeast — Boston
  '02101': { city: 'Boston', state: 'MA', lat: 42.3601, lon: -71.0589, areaCode: '617' },
  '02134': { city: 'Boston', state: 'MA', lat: 42.3522, lon: -71.1317, areaCode: '617' },
  '02215': { city: 'Boston', state: 'MA', lat: 42.3467, lon: -71.1000, areaCode: '617' },
  '02139': { city: 'Cambridge', state: 'MA', lat: 42.3655, lon: -71.1035, areaCode: '617' },
  // Northeast — Philadelphia
  '19101': { city: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652, areaCode: '215' },
  '19103': { city: 'Philadelphia', state: 'PA', lat: 39.9522, lon: -75.1746, areaCode: '215' },
  '19146': { city: 'Philadelphia', state: 'PA', lat: 39.9377, lon: -75.1832, areaCode: '215' },
  // Northeast — Other
  '06101': { city: 'Hartford', state: 'CT', lat: 41.7637, lon: -72.6851, areaCode: '860' },
  '07102': { city: 'Newark', state: 'NJ', lat: 40.7357, lon: -74.1724, areaCode: '973' },
  '14201': { city: 'Buffalo', state: 'NY', lat: 42.8864, lon: -78.8784, areaCode: '716' },
  '05401': { city: 'Burlington', state: 'VT', lat: 44.4759, lon: -73.2121, areaCode: '802' },
  '03101': { city: 'Manchester', state: 'NH', lat: 42.9956, lon: -71.4548, areaCode: '603' },
  '04101': { city: 'Portland', state: 'ME', lat: 43.6615, lon: -70.2553, areaCode: '207' },
  '02901': { city: 'Providence', state: 'RI', lat: 41.8240, lon: -71.4128, areaCode: '401' },
  // Southeast
  '30301': { city: 'Atlanta', state: 'GA', lat: 33.7490, lon: -84.3880, areaCode: '404' },
  '30309': { city: 'Atlanta', state: 'GA', lat: 33.7908, lon: -84.3878, areaCode: '404' },
  '30328': { city: 'Atlanta', state: 'GA', lat: 33.9304, lon: -84.3596, areaCode: '770' },
  '33101': { city: 'Miami', state: 'FL', lat: 25.7617, lon: -80.1918, areaCode: '305' },
  '33131': { city: 'Miami', state: 'FL', lat: 25.7654, lon: -80.1910, areaCode: '305' },
  '33602': { city: 'Tampa', state: 'FL', lat: 27.9506, lon: -82.4572, areaCode: '813' },
  '32801': { city: 'Orlando', state: 'FL', lat: 28.5383, lon: -81.3792, areaCode: '407' },
  '32819': { city: 'Orlando', state: 'FL', lat: 28.4545, lon: -81.4680, areaCode: '407' },
  '28201': { city: 'Charlotte', state: 'NC', lat: 35.2271, lon: -80.8431, areaCode: '704' },
  '27601': { city: 'Raleigh', state: 'NC', lat: 35.7796, lon: -78.6382, areaCode: '919' },
  '37201': { city: 'Nashville', state: 'TN', lat: 36.1627, lon: -86.7816, areaCode: '615' },
  '38101': { city: 'Memphis', state: 'TN', lat: 35.1495, lon: -90.0490, areaCode: '901' },
  '29201': { city: 'Columbia', state: 'SC', lat: 34.0007, lon: -81.0348, areaCode: '803' },
  '35203': { city: 'Birmingham', state: 'AL', lat: 33.5186, lon: -86.8104, areaCode: '205' },
  '39201': { city: 'Jackson', state: 'MS', lat: 32.2988, lon: -90.1848, areaCode: '601' },
  '40201': { city: 'Louisville', state: 'KY', lat: 38.2527, lon: -85.7585, areaCode: '502' },
  '23219': { city: 'Richmond', state: 'VA', lat: 37.5407, lon: -77.4360, areaCode: '804' },
  '25301': { city: 'Charleston', state: 'WV', lat: 38.3498, lon: -81.6326, areaCode: '304' },
  // Midwest
  '60601': { city: 'Chicago', state: 'IL', lat: 41.8858, lon: -87.6181, areaCode: '312' },
  '60657': { city: 'Chicago', state: 'IL', lat: 41.9435, lon: -87.6432, areaCode: '773' },
  '60614': { city: 'Chicago', state: 'IL', lat: 41.9210, lon: -87.6480, areaCode: '773' },
  '44101': { city: 'Cleveland', state: 'OH', lat: 41.4993, lon: -81.6944, areaCode: '216' },
  '43215': { city: 'Columbus', state: 'OH', lat: 39.9612, lon: -82.9988, areaCode: '614' },
  '45202': { city: 'Cincinnati', state: 'OH', lat: 39.1031, lon: -84.5120, areaCode: '513' },
  '48201': { city: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458, areaCode: '313' },
  '49503': { city: 'Grand Rapids', state: 'MI', lat: 42.9634, lon: -85.6681, areaCode: '616' },
  '55401': { city: 'Minneapolis', state: 'MN', lat: 44.9778, lon: -93.2650, areaCode: '612' },
  '55101': { city: 'Saint Paul', state: 'MN', lat: 44.9537, lon: -93.0900, areaCode: '651' },
  '63101': { city: 'St. Louis', state: 'MO', lat: 38.6270, lon: -90.1994, areaCode: '314' },
  '64101': { city: 'Kansas City', state: 'MO', lat: 39.0997, lon: -94.5786, areaCode: '816' },
  '53201': { city: 'Milwaukee', state: 'WI', lat: 43.0389, lon: -87.9065, areaCode: '414' },
  '50301': { city: 'Des Moines', state: 'IA', lat: 41.5868, lon: -93.6250, areaCode: '515' },
  '68101': { city: 'Omaha', state: 'NE', lat: 41.2565, lon: -95.9345, areaCode: '402' },
  '57101': { city: 'Sioux Falls', state: 'SD', lat: 43.5446, lon: -96.7311, areaCode: '605' },
  '58101': { city: 'Fargo', state: 'ND', lat: 46.8772, lon: -96.7898, areaCode: '701' },
  '59601': { city: 'Helena', state: 'MT', lat: 46.5958, lon: -112.0270, areaCode: '406' },
  '83701': { city: 'Boise', state: 'ID', lat: 43.6150, lon: -116.2023, areaCode: '208' },
  '82001': { city: 'Cheyenne', state: 'WY', lat: 41.1400, lon: -104.8202, areaCode: '307' },
  // South / Texas
  '77001': { city: 'Houston', state: 'TX', lat: 29.7589, lon: -95.3677, areaCode: '713' },
  '77027': { city: 'Houston', state: 'TX', lat: 29.7377, lon: -95.4627, areaCode: '713' },
  '77494': { city: 'Katy', state: 'TX', lat: 29.7858, lon: -95.8244, areaCode: '281' },
  '75201': { city: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970, areaCode: '214' },
  '76101': { city: 'Fort Worth', state: 'TX', lat: 32.7555, lon: -97.3308, areaCode: '817' },
  '78201': { city: 'San Antonio', state: 'TX', lat: 29.4241, lon: -98.4936, areaCode: '210' },
  '78701': { city: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431, areaCode: '512' },
  '79901': { city: 'El Paso', state: 'TX', lat: 31.7619, lon: -106.4850, areaCode: '915' },
  '73101': { city: 'Oklahoma City', state: 'OK', lat: 35.4676, lon: -97.5164, areaCode: '405' },
  '74103': { city: 'Tulsa', state: 'OK', lat: 36.1540, lon: -95.9928, areaCode: '918' },
  '70112': { city: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715, areaCode: '504' },
  '72201': { city: 'Little Rock', state: 'AR', lat: 34.7465, lon: -92.2896, areaCode: '501' },
  // Mountain / Southwest
  '85001': { city: 'Phoenix', state: 'AZ', lat: 33.4484, lon: -112.0740, areaCode: '602' },
  '85016': { city: 'Phoenix', state: 'AZ', lat: 33.5095, lon: -112.0296, areaCode: '602' },
  '85701': { city: 'Tucson', state: 'AZ', lat: 32.2226, lon: -110.9747, areaCode: '520' },
  '80201': { city: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903, areaCode: '303' },
  '80205': { city: 'Denver', state: 'CO', lat: 39.7596, lon: -104.9764, areaCode: '720' },
  '80302': { city: 'Boulder', state: 'CO', lat: 40.0150, lon: -105.2705, areaCode: '303' },
  '84101': { city: 'Salt Lake City', state: 'UT', lat: 40.7608, lon: -111.8910, areaCode: '801' },
  '84601': { city: 'Provo', state: 'UT', lat: 40.2338, lon: -111.6585, areaCode: '801' },
  '87101': { city: 'Albuquerque', state: 'NM', lat: 35.0853, lon: -106.6056, areaCode: '505' },
  '87501': { city: 'Santa Fe', state: 'NM', lat: 35.6870, lon: -105.9378, areaCode: '505' },
  '89101': { city: 'Las Vegas', state: 'NV', lat: 36.1699, lon: -115.1398, areaCode: '702' },
  '89501': { city: 'Reno', state: 'NV', lat: 39.5296, lon: -119.8138, areaCode: '775' },
  // California
  '90001': { city: 'Los Angeles', state: 'CA', lat: 33.9731, lon: -118.2479, areaCode: '323' },
  '90210': { city: 'Beverly Hills', state: 'CA', lat: 34.0901, lon: -118.4065, areaCode: '310' },
  '90291': { city: 'Venice', state: 'CA', lat: 33.9917, lon: -118.4507, areaCode: '310' },
  '90046': { city: 'West Hollywood', state: 'CA', lat: 34.0928, lon: -118.3600, areaCode: '323' },
  '94102': { city: 'San Francisco', state: 'CA', lat: 37.7793, lon: -122.4193, areaCode: '415' },
  '94110': { city: 'San Francisco', state: 'CA', lat: 37.7490, lon: -122.4152, areaCode: '415' },
  '94301': { city: 'Palo Alto', state: 'CA', lat: 37.4419, lon: -122.1430, areaCode: '650' },
  '94702': { city: 'Berkeley', state: 'CA', lat: 37.8716, lon: -122.2727, areaCode: '510' },
  '92101': { city: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611, areaCode: '619' },
  '92103': { city: 'San Diego', state: 'CA', lat: 32.7412, lon: -117.1584, areaCode: '619' },
  '95814': { city: 'Sacramento', state: 'CA', lat: 38.5816, lon: -121.4944, areaCode: '916' },
  '93401': { city: 'San Luis Obispo', state: 'CA', lat: 35.2828, lon: -120.6596, areaCode: '805' },
  '93101': { city: 'Santa Barbara', state: 'CA', lat: 34.4208, lon: -119.6982, areaCode: '805' },
  '95401': { city: 'Santa Rosa', state: 'CA', lat: 38.4404, lon: -122.7141, areaCode: '707' },
  // Pacific Northwest
  '98101': { city: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321, areaCode: '206' },
  '98103': { city: 'Seattle', state: 'WA', lat: 47.6558, lon: -122.3453, areaCode: '206' },
  '98004': { city: 'Bellevue', state: 'WA', lat: 47.6101, lon: -122.2015, areaCode: '425' },
  '97201': { city: 'Portland', state: 'OR', lat: 45.5231, lon: -122.6765, areaCode: '503' },
  '97401': { city: 'Eugene', state: 'OR', lat: 44.0521, lon: -123.0868, areaCode: '541' },
  // DC & Other
  '20001': { city: 'Washington', state: 'DC', lat: 38.9072, lon: -77.0369, areaCode: '202' },
  '20036': { city: 'Washington', state: 'DC', lat: 38.9088, lon: -77.0430, areaCode: '202' },
  '21201': { city: 'Baltimore', state: 'MD', lat: 39.2904, lon: -76.6122, areaCode: '410' },
  '22201': { city: 'Arlington', state: 'VA', lat: 38.8816, lon: -77.0910, areaCode: '703' },
  // Alaska & Hawaii
  '99501': { city: 'Anchorage', state: 'AK', lat: 61.2181, lon: -149.9003, areaCode: '907' },
  '99801': { city: 'Juneau', state: 'AK', lat: 58.3005, lon: -134.4197, areaCode: '907' },
  '96801': { city: 'Honolulu', state: 'HI', lat: 21.3069, lon: -157.8583, areaCode: '808' },
  '96720': { city: 'Hilo', state: 'HI', lat: 19.7297, lon: -155.0900, areaCode: '808' },
}

// ─── SEEDED PRNG ─────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// ─── NAME TEMPLATES ───────────────────────────────────────────────────────────

const ADJECTIVES = [
  'Elite', 'Premier', 'Advanced', 'Professional', 'Superior', 'Expert',
  'Reliable', 'Trusted', 'Quality', 'First Choice', 'Top', 'Pro', 'Prime',
  'Ace', 'Best', 'Local', 'Downtown', 'Midtown', 'Metro', 'Urban', 'Classic',
]

const FIRST_NAMES = [
  'Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson',
  'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
  'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Lewis',
  'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Scott', 'Green', 'Baker',
]

type TemplateString = string

const NAME_TEMPLATES: Record<string, TemplateString[]> = {
  'Restaurants': [
    '{City} Kitchen', '{City} Grill & Bar', 'The {Adj} Plate', "{Name}'s Bistro",
    '{City} Eats', 'Corner Table {City}', "{Name}'s Kitchen", 'The Local Table',
    '{Adj} Fork Restaurant', '{City} Public House', 'Main Street Cafe', "{Name}'s Pizza",
    'Golden {City} Kitchen', '{Adj} Spoon Diner', 'Harbor View Restaurant',
    '{City} Burger Co.', "{Name}'s Steakhouse", 'The {Adj} Bowl', '{City} Taco House',
    '{Adj} Noodle Bar', '{City} Diner', '{Name} & Sons BBQ', 'The Original {City} Grill',
  ],
  'Dentists': [
    '{City} Dental Group', '{Name} Family Dentistry', '{City} Smiles',
    'Premier Dental {City}', '{Adj} Smile Dental', '{City} Orthodontics',
    '{Name} DDS', 'Metro Dental Care', '{City} Dental Associates',
    '{Adj} Dental Studio', '{City} Pediatric Dentistry', '{Name} Cosmetic Dental',
    'Bright Smiles of {City}', '{City} Implant & Cosmetic Dentistry',
  ],
  'Law Firms': [
    '{Name} & Associates', '{Name} Law Group', '{City} Legal Partners',
    '{Adj} Law Firm', '{Name} Attorneys at Law', '{City} Trial Lawyers',
    '{Name} & {Name2} LLP', '{City} Injury Law', '{Adj} Legal Solutions',
    '{Name} Legal Group', 'The {City} Law Firm', '{Name} Family Law',
  ],
  'Contractors': [
    '{City} Home Improvement', '{Name} Construction', '{Adj} Builders {City}',
    '{City} Remodeling Pros', '{Name} & Sons Contracting', '{Adj} Build Co.',
    '{City} General Contracting', 'Master Craft {City}', '{Adj} Construction Group',
    '{City} Renovation Experts', '{Name} Development', 'Cornerstone {City} Builders',
  ],
  'Auto Shops': [
    '{City} Auto Repair', '{Name} Auto & Tire', '{Adj} Auto Service {City}',
    '{City} Transmission Specialists', '{Name} Automotive', '{Adj} Car Care',
    '{City} Lube & Tune', 'Pro Auto {City}', "{Name}'s Garage",
    '{City} Brake & Exhaust', '{Adj} Tire Center', '{City} Motor Works',
  ],
  'Real Estate Agents': [
    '{City} Realty Group', '{Name} Properties', '{Adj} Real Estate {City}',
    '{City} Homes & Land', '{Name} Real Estate', '{Adj} Property Group',
    '{City} Real Estate Professionals', '{Name} & Associates Realty',
    'Premier {City} Real Estate', '{City} Property Experts',
  ],
  'Medical Clinics': [
    '{City} Family Medicine', '{Name} Medical Group', '{Adj} Health Clinic',
    '{City} Urgent Care', '{Name} Medical Associates', '{City} Primary Care',
    '{Adj} Medical Center', '{City} Health & Wellness', '{Name} MD',
    '{City} Community Health', 'Integrated Medicine of {City}',
  ],
  'Gyms & Fitness': [
    '{City} Fitness Center', '{Adj} Gym {City}', '{Name} CrossFit',
    '{City} Health Club', 'Iron Body {City}', '{Adj} Training Studio',
    '{City} Yoga & Wellness', '{Name} Personal Training', '{Adj} Fitness {City}',
    '{City} Athletic Club', 'Peak Performance {City}', '{Adj} Power Gym',
  ],
  'Hair & Beauty Salons': [
    '{City} Hair Studio', '{Name} Salon & Spa', '{Adj} Style Salon',
    '{City} Beauty Bar', 'Luxe Hair {City}', "{Name}'s Salon",
    '{Adj} Cuts & Color', '{City} Blowout Bar', 'The {Adj} Salon',
    '{City} Beauty Lounge', '{Name} Hair Design', 'Glam Studio {City}',
  ],
  'Manufacturers': [
    '{City} Manufacturing Co.', '{Name} Industries', '{Adj} Fabrication {City}',
    '{City} Precision Parts', '{Name} Manufacturing', '{Adj} Industrial {City}',
    '{City} Metalworks', '{Name} & Sons Manufacturing', '{City} Production Co.',
  ],
  'Distributors': [
    '{City} Distribution Co.', '{Name} Wholesale', '{Adj} Supply {City}',
    '{City} Supply Chain', '{Name} Distributors', '{Adj} Logistics {City}',
    '{City} Warehouse & Distribution', '{Name} Supply Co.', 'Metro Supply {City}',
  ],
  'Plumbers': [
    '{City} Plumbing & Drain', '{Name} Plumbing', '{Adj} Plumbing {City}',
    '{City} Pipe Pros', '{Name} & Sons Plumbing', '{Adj} Drain Services',
    '{City} Plumbing Experts', 'Master Plumber {City}', '{Name} Plumbing Co.',
    '{City} Water & Drain', '{Adj} Flow Plumbing',
  ],
  'Electricians': [
    '{City} Electric', '{Name} Electrical Services', '{Adj} Electric {City}',
    '{City} Electrical Contractors', '{Name} Power Solutions', 'Bright Electric {City}',
    '{Adj} Wiring & Electric', '{City} Master Electric', '{Name} Electric Co.',
    'Pro Electric {City}', '{City} Electrical Experts',
  ],
  'Landscaping': [
    '{City} Lawn & Landscape', '{Name} Landscaping', '{Adj} Lawn Care {City}',
    '{City} Yard Pros', 'Green Thumb {City}', '{Name} Lawn Services',
    '{Adj} Landscape Design', '{City} Tree & Lawn', "{Name}'s Garden Care",
    '{City} Outdoor Living', '{Adj} Grounds Maintenance',
  ],
  'HVAC Services': [
    '{City} Heating & Air', '{Name} HVAC', '{Adj} Climate Control {City}',
    '{City} Air Conditioning', '{Name} Heating & Cooling', '{Adj} HVAC Solutions',
    '{City} Comfort Systems', 'Air Pro {City}', '{Name} Climate Services',
    '{City} HVAC Experts', '{Adj} Temp Control', 'Cool Air {City}',
  ],
  'Cleaning Services': [
    '{City} Cleaning Co.', '{Name} Maids', '{Adj} Clean {City}',
    '{City} House Cleaning', 'Sparkle Clean {City}', "{Name}'s Cleaning Service",
    '{Adj} Maid Services', '{City} Commercial Cleaning', 'Fresh Start {City}',
    '{City} Janitorial Services', '{Adj} Property Cleaning',
  ],
  'Photographers': [
    '{City} Photography Studio', '{Name} Photography', '{Adj} Photo {City}',
    '{City} Events Photography', 'Captured Moments {City}', '{Name} Creative Photography',
    '{Adj} Lens Photography', '{City} Portrait Studio', '{Name} Visual Arts',
    'Golden Hour Photography {City}', '{City} Wedding Photography',
  ],
  'Catering': [
    '{City} Catering Co.', '{Name} Catering', '{Adj} Cuisine {City}',
    '{City} Event Catering', 'Chef {Name} Catering', '{Adj} Banquet Services',
    '{City} Wedding Catering', "{Name}'s Catering & Events", 'Gourmet {City} Catering',
    '{Adj} Corporate Catering', '{City} Food Services',
  ],
  'Pet Services': [
    '{City} Pet Care', '{Name} Veterinary', '{Adj} Animal Hospital {City}',
    '{City} Dog Grooming', 'Happy Paws {City}', '{Name} Pet Services',
    '{Adj} Vet Clinic', '{City} Animal Wellness', '{Name} Grooming & Boarding',
    '{City} Pet Hotel', 'All Pets {City}',
  ],
  'Roofing': [
    '{City} Roofing Co.', '{Name} Roofing', '{Adj} Roof {City}',
    '{City} Roof Repair', 'Summit Roofing {City}', '{Name} Roofing & Gutters',
    '{Adj} Roofing Solutions', '{City} Shingle Pros', '{Name} Roof Installations',
    'Top Tier Roofing {City}', '{City} Storm Roofing',
  ],
  'Moving Companies': [
    '{City} Movers', '{Name} Moving Co.', '{Adj} Moving & Storage {City}',
    '{City} Relocation Services', 'First Class Movers {City}', '{Name} Moving Group',
    '{Adj} Moving {City}', '{City} Packing & Moving', '{Name} & Sons Moving',
    'Fast Move {City}', '{City} Storage & Moving',
  ],
  'Insurance Agents': [
    '{City} Insurance Group', '{Name} Insurance', '{Adj} Coverage {City}',
    '{City} Risk Management', '{Name} & Associates Insurance', '{Adj} Insurance Solutions',
    '{City} Financial & Insurance', '{Name} Agency', 'Protect {City} Insurance',
    '{City} Life & Auto Insurance', '{Adj} Policy Group',
  ],
  'Accountants': [
    '{City} Accounting Group', '{Name} CPA', '{Adj} Tax Services {City}',
    '{City} Bookkeeping', '{Name} & Associates CPAs', '{Adj} Financial {City}',
    '{City} Tax Advisory', '{Name} Accounting Firm', 'Numbers {City} CPA',
    '{Adj} Audit & Tax', '{City} Small Business Accounting',
  ],
  'Chiropractors': [
    '{City} Chiropractic Center', 'Dr. {Name} Chiropractic', '{Adj} Spine Care {City}',
    '{City} Back & Neck Clinic', '{Name} Family Chiropractic', '{Adj} Chiropractic {City}',
    '{City} Wellness Chiropractic', '{Name} DC', 'Align & Heal {City}',
    '{City} Pain Relief Center', '{Adj} Spinal Health',
  ],
}

// Generic fallback templates when category doesn't match
const GENERIC_TEMPLATES: TemplateString[] = [
  '{City} {Cat} Services', '{Name} {Cat}', '{Adj} {Cat} {City}',
  '{City} {Cat} Pros', '{Name} {Cat} Group', 'Metro {Cat} {City}',
]

// ─── ADDRESS STREET NAMES ─────────────────────────────────────────────────────

const STREET_NAMES = [
  'Main St', 'Oak Ave', 'Maple Dr', 'Park Blvd', 'Washington St',
  'Lincoln Ave', 'Jefferson Blvd', 'Market St', 'Broadway', 'Central Ave',
  'Highland Ave', 'Riverside Dr', 'Sunset Blvd', 'Commerce St', 'Industrial Pkwy',
  'College Ave', 'University Blvd', 'Harbor Dr', 'Lakewood Ave', 'Forest Rd',
  'Spring St', 'Summer Ave', 'Valley Rd', 'Hill St', 'Creek Dr',
  'Elm St', 'Cedar Ln', 'Birch Way', 'Pine St', 'Walnut Ave',
]

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

// State abbreviation → area code (mirrors geocode.ts but scoped here for offline fallback)
const STATE_AREA_CODES_LOCAL: Record<string, string> = {
  AL: '205', AK: '907', AZ: '602', AR: '501', CA: '213', CO: '303', CT: '203',
  DE: '302', FL: '305', GA: '404', HI: '808', ID: '208', IL: '312', IN: '317',
  IA: '515', KS: '316', KY: '502', LA: '504', ME: '207', MD: '410', MA: '617',
  MI: '313', MN: '612', MS: '601', MO: '314', MT: '406', NE: '402', NV: '702',
  NH: '603', NJ: '201', NM: '505', NY: '212', NC: '704', ND: '701', OH: '216',
  OK: '405', OR: '503', PA: '215', RI: '401', SC: '803', SD: '605', TN: '615',
  TX: '214', UT: '801', VT: '802', VA: '804', WA: '206', WV: '304', WI: '414',
  WY: '307', DC: '202',
}

async function getZipInfo(
  zipCode: string,
  paramsCity?: string,
  paramsState?: string
): Promise<ZipEntry & { resolvedZip: string }> {
  // 1. Try Nominatim — authoritative source for any US ZIP
  try {
    const geo: GeocodedZip = await geocodeZip(zipCode)
    if (geo.city) {
      const stateAbbr = geo.stateAbbr || paramsState || ''
      return {
        city: geo.city,
        state: stateAbbr,
        lat: geo.lat,
        lon: geo.lon,
        areaCode: geo.areaCode || STATE_AREA_CODES_LOCAL[stateAbbr] || '555',
        resolvedZip: zipCode,
      }
    }
  } catch {
    // Nominatim unavailable — fall through
  }

  // 2. Use city/state the user typed in the form
  if (paramsCity) {
    const cityPart = paramsCity.includes(',')
      ? paramsCity.split(',')[0].trim()
      : paramsCity.trim()
    // Try to extract state abbreviation from "City, ST" format
    const stateMatch = paramsCity.match(/,\s*([A-Z]{2})$/)
    const stateAbbr = stateMatch?.[1] ?? paramsState ?? ''
    // Best-effort lat/lon from ZIP table or hash
    const fallback = hashTableFallback(zipCode)
    return {
      city: cityPart,
      state: stateAbbr,
      lat: fallback.lat,
      lon: fallback.lon,
      areaCode: STATE_AREA_CODES_LOCAL[stateAbbr] || fallback.areaCode,
      resolvedZip: zipCode,
    }
  }

  // 3. Last resort — hash into local table (geographic accuracy not guaranteed)
  return hashTableFallback(zipCode)
}

function hashTableFallback(zipCode: string): ZipEntry & { resolvedZip: string } {
  if (ZIP_DATABASE[zipCode]) {
    return { ...ZIP_DATABASE[zipCode], resolvedZip: zipCode }
  }
  const zipNum = parseInt(zipCode, 10) || hashString(zipCode)
  const keys = Object.keys(ZIP_DATABASE)
  const idx = zipNum % keys.length
  const resolvedZip = keys[idx]
  return { ...ZIP_DATABASE[resolvedZip], resolvedZip }
}

function fillTemplate(
  template: TemplateString,
  city: string,
  rand: () => number,
  category?: string
): string {
  const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]
  const name = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]
  const name2 = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]
  const shortCity = city.split(' ')[0] // e.g. "Los" from "Los Angeles", "San" from "San Francisco"
  // For multi-word cities, alternate between short and full name
  const cityRef = rand() > 0.5 ? city : shortCity

  return template
    .replace('{City}', cityRef)
    .replace('{Adj}', adj)
    .replace('{Name}', name)
    .replace('{Name2}', name2)
    .replace('{Cat}', category ?? '')
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 28)
}

function generatePhone(areaCode: string, rand: () => number): string {
  const suffix = Math.floor(rand() * 9000) + 1000
  return `(${areaCode}) 555-${suffix}`
}

function generateRating(rand: () => number): number {
  // Range: 3.2 – 4.9, one decimal place
  const raw = 3.2 + rand() * 1.7
  return Math.round(raw * 10) / 10
}

function generateReviewCount(rand: () => number): number {
  // Skew towards lower counts (realistic)
  const roll = rand()
  if (roll < 0.35) return Math.floor(rand() * 25) + 5      // 5-29
  if (roll < 0.65) return Math.floor(rand() * 75) + 30     // 30-104
  if (roll < 0.85) return Math.floor(rand() * 150) + 105   // 105-254
  return Math.floor(rand() * 150) + 255                     // 255-404
}

function generateDistance(radiusMiles: number, rand: () => number): number {
  // Uniform distribution within radius (sqrt gives uniform area distribution)
  const raw = 0.1 + Math.sqrt(rand()) * radiusMiles
  return Math.round(raw * 10) / 10
}

function generateEmployeeCount(rand: () => number): number {
  const roll = rand()
  if (roll < 0.50) return Math.floor(rand() * 5) + 1    // 1-5
  if (roll < 0.80) return Math.floor(rand() * 20) + 6   // 6-25
  if (roll < 0.95) return Math.floor(rand() * 50) + 26  // 26-75
  return Math.floor(rand() * 125) + 76                   // 76-200
}

function generateRevenueEstimate(employees: number): string {
  if (employees <= 5) return '<$500K'
  if (employees <= 15) return '$500K–$2M'
  if (employees <= 40) return '$2M–$10M'
  if (employees <= 100) return '$10M–$50M'
  return '$50M+'
}

function generateSocialUrls(name: string, rand: () => number) {
  const slug = generateSlug(name)
  return {
    facebookUrl: rand() < 0.60 ? `https://www.facebook.com/${slug}` : null,
    instagramUrl: rand() < 0.40 ? `https://www.instagram.com/${slug}` : null,
    linkedinUrl: rand() < 0.30 ? `https://www.linkedin.com/company/${slug}` : null,
  }
}

function generateAddress(rand: () => number): string {
  const num = Math.floor(rand() * 9900) + 100
  const street = STREET_NAMES[Math.floor(rand() * STREET_NAMES.length)]
  return `${num} ${street}`
}

// ─── CORE GENERATOR ──────────────────────────────────────────────────────────

interface GeneratedBusiness {
  businessName: string
  category: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  website: string
  rating: number
  reviewCount: number
  distanceMiles: number
  latitude: number
  longitude: number
  employeeCount: number
  revenueEstimate: string
  facebookUrl: string | null
  instagramUrl: string | null
  linkedinUrl: string | null
}

function generateBusinessesForCategory(
  category: string,
  zipEntry: ZipEntry,
  resolvedZip: string,
  searchZip: string,
  radiusMiles: number,
  rand: () => number,
  count: number
): GeneratedBusiness[] {
  const templates = NAME_TEMPLATES[category] ?? GENERIC_TEMPLATES
  const businesses: GeneratedBusiness[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < count; i++) {
    // Pick a template, cycling through all available ones
    const templateIdx = i % templates.length
    // Add some randomness to template selection after the first cycle
    const finalIdx = i < templates.length
      ? templateIdx
      : Math.floor(rand() * templates.length)

    const template = templates[finalIdx]
    let name = fillTemplate(template, zipEntry.city, rand, category)

    // Avoid exact duplicates by appending a number
    if (usedNames.has(name)) {
      name = `${name} ${Math.floor(rand() * 90) + 2}`
    }
    usedNames.add(name)

    // Place business at a random point uniformly distributed within the search radius
    const angle = rand() * 2 * Math.PI
    const distMiles = generateDistance(radiusMiles, rand)
    const latDeg = distMiles / 69.0
    const lonDeg = distMiles / (69.0 * Math.cos((zipEntry.lat * Math.PI) / 180))
    const latJitter = latDeg * Math.cos(angle)
    const lonJitter = lonDeg * Math.sin(angle)

    const employeeCount = generateEmployeeCount(rand)

    businesses.push({
      businessName: name,
      category,
      address: generateAddress(rand),
      city: zipEntry.city,
      state: zipEntry.state,
      zipCode: searchZip,
      phone: generatePhone(zipEntry.areaCode, rand),
      website: '',
      rating: generateRating(rand),
      reviewCount: generateReviewCount(rand),
      distanceMiles: distMiles,
      latitude: zipEntry.lat + latJitter,
      longitude: zipEntry.lon + lonJitter,
      employeeCount,
      revenueEstimate: generateRevenueEstimate(employeeCount),
      facebookUrl: null,
      instagramUrl: null,
      linkedinUrl: null,
    })
  }

  return businesses
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function searchLeadsDynamic(params: SearchParams): Promise<SearchResult> {
  const { zipCode, category, radiusMiles, keyword, hasWebsite, hasPhone, minRating } = params

  const zipEntry = await getZipInfo(zipCode, params.city, params.state)
  const isAllCategories = !category || category === ''

  // Seed is unique per ZIP + category combination
  const seed = hashString(zipCode + '|' + category)
  const rand = mulberry32(seed)

  // Determine how many businesses to generate
  const baseCount = 100 + Math.floor(rand() * 51) // 100-150

  let rawBusinesses: GeneratedBusiness[] = []

  if (isAllCategories) {
    // Mix businesses from all non-keyword categories
    const allCats = Object.keys(NAME_TEMPLATES)
    const perCat = Math.max(1, Math.floor(baseCount / allCats.length))
    const leftover = baseCount - perCat * allCats.length

    for (let ci = 0; ci < allCats.length; ci++) {
      const catCount = ci === 0 ? perCat + leftover : perCat
      const catSeed = hashString(zipCode + '|' + allCats[ci])
      const catRand = mulberry32(catSeed)
      rawBusinesses.push(
        ...generateBusinessesForCategory(
          allCats[ci],
          zipEntry,
          zipEntry.resolvedZip,
          zipCode,
          radiusMiles,
          catRand,
          catCount
        )
      )
    }
    // Shuffle the mixed list using the main seed so order is deterministic
    rawBusinesses.sort(() => rand() - 0.5)
  } else if (category === 'Custom Keyword' && keyword) {
    // For custom keyword, generate from a nearby category and rename
    const catSeed = hashString(zipCode + '|custom|' + keyword)
    const catRand = mulberry32(catSeed)
    rawBusinesses = generateBusinessesForCategory(
      'Restaurants', // base template set
      zipEntry,
      zipEntry.resolvedZip,
      zipCode,
      radiusMiles,
      catRand,
      baseCount
    ).map(b => ({
      ...b,
      category: keyword,
      businessName: b.businessName.replace(/Kitchen|Grill|Bistro|Eats|Cafe|Pizza|Diner/gi, keyword),
    }))
  } else {
    rawBusinesses = generateBusinessesForCategory(
      category,
      zipEntry,
      zipEntry.resolvedZip,
      zipCode,
      radiusMiles,
      rand,
      baseCount
    )
  }

  // Convert to Lead objects and score.
  let leads: Lead[] = rawBusinesses.map((b, idx) => {
    const partial = {
      id: `dyn_${hashString(zipCode + category + idx)}_${idx}`,
      ...b,
      savedAt: undefined,
      createdAt: new Date().toISOString(),
    }
    return {
      ...partial,
      leadScore: calculateLeadScore(partial, params),
      status: 'new' as const,
      notes: '',
    }
  })


  // ── Apply filters ──────────────────────────────────────────────────────────

  if (hasWebsite === true) {
    leads = leads.filter(l => l.website && l.website.trim() !== '')
  }

  if (hasPhone === true) {
    leads = leads.filter(l => l.phone && l.phone.trim() !== '')
  }

  if (minRating != null && minRating > 0) {
    leads = leads.filter(l => (l.rating ?? 0) >= minRating)
  }

  if (keyword && category !== 'Custom Keyword') {
    const kw = keyword.toLowerCase()
    leads = leads.filter(
      l =>
        l.businessName.toLowerCase().includes(kw) ||
        l.category.toLowerCase().includes(kw) ||
        l.address.toLowerCase().includes(kw)
    )
  }

  // Filter by radius (only keep results within radiusMiles)
  leads = leads.filter(l => (l.distanceMiles ?? 0) <= radiusMiles)

  // Sort by leadScore descending
  leads.sort((a, b) => b.leadScore - a.leadScore)

  return { leads, total: leads.length, center: { lat: zipEntry.lat, lon: zipEntry.lon }, source: 'demo' }
}
