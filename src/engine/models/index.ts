// Pluggable Pricing Models Registry

export * from './monthlyFixed';
export * from './perTripPackage';

export interface PricingModelPlugin {
  id: string;
  name: string;
  description: string;
  parameterSchema: Record<string, any>;
  calculate: (input: any) => any;
}

export const PRICING_MODELS: Record<string, { id: string; name: string; description: string }> = {
  monthly_fixed: {
    id: 'monthly_fixed',
    name: 'Monthly Fixed Contract',
    description: 'Fixed monthly retainer covering included KM and daily hours (e.g. VTL: ₹65,000 for 3000 km, 12h/day). Extra hours and extra km billed above threshold.',
  },
  per_trip_package: {
    id: 'per_trip_package',
    name: 'Per-Trip Package (Daily Hire)',
    description: 'Base daily package for defined hours & km (e.g. School: ₹2,415 for 10h/80km). Additional hours pro-rata by minute, additional km at per-km rate.',
  },
  per_km: {
    id: 'per_km',
    name: 'Per-Kilometre Rate',
    description: 'Billed purely on distance travelled with optional minimum charge.',
  },
  per_hour: {
    id: 'per_hour',
    name: 'Hourly Charter',
    description: 'Billed on duration in minutes with minimum package.',
  },
  slab: {
    id: 'slab',
    name: 'Distance Slab Pricing',
    description: 'Progressive tiered rates for outstation journeys.',
  },
  per_day: {
    id: 'per_day',
    name: 'Daily Flat Rate',
    description: 'Fixed daily rate with driver allowance included.',
  },
};
