export interface CorridorResult {
  detected: boolean;
  placeName: string | null;
  placeType: string | null;
  distanceMeters: number | null;
  slaMultiplier: number;
  priorityBoost: number;
  reason: string | null;
}

export const CORRIDOR_TYPES = [
  'hospital',
  'school', 
  'transit_station',
  'fire_station',
  'police'
];

export const getCorridorLabel = (type: string): string => {
  const labels: Record<string, string> = {
    hospital: '🏥 Hospital',
    school: '🏫 School', 
    transit_station: '🚇 Transit hub',
    fire_station: '🚒 Fire station',
    police: '👮 Police station',
  };
  return labels[type] || '🏛️ Critical facility';
};
