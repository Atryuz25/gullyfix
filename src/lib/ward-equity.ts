export const CITIES_AND_WARDS: Record<string, string[]> = {
  "Mumbai": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5", "Ward 6"],
  "Delhi": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5", "Ward 6"],
  "Bangalore": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5", "Ward 6"],
  "Hyderabad": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5", "Ward 6"],
  "Chennai": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5"],
  "Kolkata": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5"],
  "Pune": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5"],
  "Ahmedabad": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5"],
  "Surat": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5"],
  "Lucknow": ["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5"],
  "Kochi": ["Ward 1", "Ward 2", "Ward 3"],
  "Indore": ["Ward 1", "Ward 2", "Ward 3"],
  "Visakhapatnam": ["Ward 1", "Ward 2", "Ward 3"],
  "Nagpur": ["Ward 1", "Ward 2", "Ward 3"],
  "Bhopal": ["Ward 1", "Ward 2", "Ward 3"],
  "Madurai": ["Ward 1", "Ward 2", "Ward 3"]
};

// Compute a deterministic equity tier based on the ward number
export const getEquityMultiplier = (city: string, ward: string) => {
  const wardNum = parseInt(ward.replace(/\D/g, '')) || 1;
  
  if (wardNum <= 2) {
    return { tier: 1, multiplier: 0.85, label: "Affluent ward" };
  } else if (wardNum <= 4) {
    return { tier: 2, multiplier: 1.0, label: "Middle-income ward" };
  } else {
    return { tier: 3, multiplier: 1.35, label: "Underserved ward" };
  }
};

export const getWardId = (city: string, wardName: string) => {
  if (!city || !wardName) return "";
  return `${city.toLowerCase().replace(/\s+/g, '_')}_${wardName.toLowerCase().replace(/\s+/g, '_')}`;
};

