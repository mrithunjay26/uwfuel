export interface CampusPlace {
  code: string;
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

export const CAMPUS_CENTER = { lat: 47.6553, lng: -122.3035 };

export const CAMPUS_BUILDINGS: CampusPlace[] = [
  { code: "MGH", name: "Mary Gates Hall", lat: 47.6547, lng: -122.3080 },
  { code: "KNE", name: "Kane Hall", lat: 47.6567, lng: -122.3090 },
  { code: "SUZ", name: "Suzzallo Library", lat: 47.6556, lng: -122.3081, aliases: ["suzzallo", "allen library", "ALB"] },
  { code: "OUG", name: "Odegaard Undergraduate Library", lat: 47.6567, lng: -122.3105, aliases: ["odegaard"] },
  { code: "SAV", name: "Savery Hall", lat: 47.6575, lng: -122.3090 },
  { code: "SMI", name: "Smith Hall", lat: 47.6570, lng: -122.3077 },
  { code: "GWN", name: "Gowen Hall", lat: 47.6565, lng: -122.3072 },
  { code: "THO", name: "Thomson Hall", lat: 47.6568, lng: -122.3067 },
  { code: "MLR", name: "Miller Hall", lat: 47.6578, lng: -122.3062 },
  { code: "RAI", name: "Raitt Hall", lat: 47.6584, lng: -122.3087 },
  { code: "DEN", name: "Denny Hall", lat: 47.6590, lng: -122.3093 },
  { code: "CMU", name: "Communications Building", lat: 47.6573, lng: -122.3053 },
  { code: "PDL", name: "Padelford Hall", lat: 47.6570, lng: -122.3040 },
  { code: "MEB", name: "Mechanical Engineering Building", lat: 47.6537, lng: -122.3046 },
  { code: "ARC", name: "Architecture Hall", lat: 47.6545, lng: -122.3035 },

  { code: "PCAR", name: "PACCAR Hall", lat: 47.6592, lng: -122.3086, aliases: ["paccar"] },
  { code: "DEM", name: "Dempsey Hall", lat: 47.6597, lng: -122.3080 },
  { code: "BLM", name: "Balmer Hall", lat: 47.6598, lng: -122.3073 },

  { code: "CSE", name: "Paul G. Allen Center", lat: 47.6531, lng: -122.3060, aliases: ["allen center", "paul allen"] },
  { code: "CSE2", name: "Bill & Melinda Gates Center", lat: 47.6530, lng: -122.3049, aliases: ["gates center"] },
  { code: "EEB", name: "Electrical & Computer Engineering", lat: 47.6537, lng: -122.3053, aliases: ["ece", "electrical engineering"] },
  { code: "GUG", name: "Guggenheim Hall", lat: 47.6539, lng: -122.3046 },
  { code: "LOW", name: "Loew Hall", lat: 47.6536, lng: -122.3043 },
  { code: "MOR", name: "More Hall", lat: 47.6531, lng: -122.3043 },
  { code: "BNS", name: "Benson Hall", lat: 47.6534, lng: -122.3075 },
  { code: "AND", name: "Anderson Hall", lat: 47.6527, lng: -122.3078 },
  { code: "SIG", name: "Sieg Building", lat: 47.6542, lng: -122.3048 },

  { code: "BAG", name: "Bagley Hall", lat: 47.6533, lng: -122.3088 },
  { code: "CHB", name: "Chemistry Building", lat: 47.6530, lng: -122.3097 },
  { code: "JHN", name: "Johnson Hall", lat: 47.6543, lng: -122.3092 },
  { code: "PAA", name: "Physics/Astronomy Auditorium", lat: 47.6535, lng: -122.3105, aliases: ["PAB", "physics"] },
  { code: "KIN", name: "Kincaid Hall", lat: 47.6534, lng: -122.3116 },
  { code: "HCK", name: "Hitchcock Hall", lat: 47.6530, lng: -122.3120 },
  { code: "LSB", name: "Life Sciences Building", lat: 47.6524, lng: -122.3096 },
  { code: "FSH", name: "Fishery Sciences", lat: 47.6532, lng: -122.3155 },
  { code: "OSB", name: "Ocean Sciences Building", lat: 47.6495, lng: -122.3122 },

  { code: "HSB", name: "Health Sciences Building", lat: 47.6500, lng: -122.3085, aliases: ["health sciences", "T-wing", "D-wing"] },
  { code: "FOE", name: "William H. Foege Building", lat: 47.6516, lng: -122.3115, aliases: ["foege"] },
  { code: "SOCC", name: "UW Medical Center", lat: 47.6497, lng: -122.3075, aliases: ["uwmc", "medical center"] },

  { code: "MNY", name: "Meany Hall", lat: 47.6557, lng: -122.3110 },
  { code: "MUS", name: "Music Building", lat: 47.6570, lng: -122.3115 },
  { code: "ART", name: "Art Building", lat: 47.6580, lng: -122.3110 },
  { code: "HUT", name: "Hutchinson Hall", lat: 47.6588, lng: -122.3108 },
  { code: "GLD", name: "Gould Hall", lat: 47.6558, lng: -122.3130 },

  { code: "HUB", name: "Husky Union Building", lat: 47.6554, lng: -122.3050, aliases: ["student union"] },
  { code: "IMA", name: "Intramural Activities Building", lat: 47.6534, lng: -122.3013, aliases: ["gym", "rec center", "intramural"] },
  { code: "HEC", name: "Alaska Airlines Arena", lat: 47.6520, lng: -122.3016, aliases: ["hec ed", "hec edmundson"] },
  { code: "STADIUM", name: "Husky Stadium", lat: 47.6503, lng: -122.3016, aliases: ["husky stadium"] },
  { code: "REDSQ", name: "Red Square", lat: 47.6560, lng: -122.3087, aliases: ["red square"] },
  { code: "FOUNTAIN", name: "Drumheller Fountain", lat: 47.6537, lng: -122.3070, aliases: ["drumheller"] },

  { code: "LAN", name: "Lander Hall", lat: 47.6560, lng: -122.3150, aliases: ["lander"] },
  { code: "ALD", name: "Alder Hall", lat: 47.6557, lng: -122.3143, aliases: ["alder"] },
  { code: "MAP", name: "Maple Hall", lat: 47.6553, lng: -122.3148, aliases: ["maple"] },
  { code: "TER", name: "Terry Hall", lat: 47.6565, lng: -122.3155, aliases: ["terry"] },
  { code: "WIL", name: "Willow Hall", lat: 47.6562, lng: -122.3168, aliases: ["willow"] },
  { code: "ELM", name: "Elm Hall", lat: 47.6550, lng: -122.3160, aliases: ["elm"] },
  { code: "OAK", name: "Oak Hall", lat: 47.6546, lng: -122.3152, aliases: ["oak"] },
  { code: "POP", name: "Poplar Hall", lat: 47.6548, lng: -122.3168, aliases: ["poplar"] },
  { code: "MCM", name: "McMahon Hall", lat: 47.6602, lng: -122.3040, aliases: ["mcmahon"] },
  { code: "HGT", name: "Haggett Hall", lat: 47.6601, lng: -122.3030, aliases: ["haggett"] },
  { code: "MCC", name: "Mercer Court", lat: 47.6549, lng: -122.3185, aliases: ["mercer"] },
];

function normalize(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function stripRoom(s: string): string {
  return s.replace(/\b[a-z]?\d{1,4}[a-z]?\b\s*$/i, "").trim();
}

const BY_CODE = new Map<string, CampusPlace>();
for (const b of CAMPUS_BUILDINGS) {
  BY_CODE.set(normalize(b.code), b);
  for (const a of b.aliases ?? []) BY_CODE.set(normalize(a), b);
}

export function resolveCampusPlace(label: string | null | undefined): CampusPlace | null {
  if (!label) return null;
  const full = normalize(label);
  if (!full) return null;
  const base = stripRoom(full) || full;

  const direct = BY_CODE.get(base) ?? BY_CODE.get(full) ?? BY_CODE.get(base.split(" ")[0]);
  if (direct) return direct;

  for (const b of CAMPUS_BUILDINGS) {
    const name = normalize(b.name);
    if (base.includes(name) || name.includes(base)) return b;
  }

  const tokens = base.split(" ").filter((t) => t.length > 2 && t !== "hall" && t !== "building");
  if (tokens.length === 0) return null;
  let best: { place: CampusPlace; score: number } | null = null;
  for (const b of CAMPUS_BUILDINGS) {
    const nameTokens = new Set(normalize(b.name).split(" "));
    const score = tokens.reduce((n, t) => n + (nameTokens.has(t) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { place: b, score };
  }
  return best?.place ?? null;
}

export function campusPlaceByCode(code: string): CampusPlace | null {
  return BY_CODE.get(normalize(code)) ?? null;
}
