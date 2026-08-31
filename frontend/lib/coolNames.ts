const ADJECTIVES = [
  "Cosmic",
  "Shadow",
  "Neon",
  "Astral",
  "Quantum",
  "Blaze",
  "Phantom",
  "Vortex",
  "Stellar",
  "Cyber",
  "Solar",
  "Mystic",
  "Swift",
  "Apex",
  "Thunder",
  "Velvet",
  "Zen",
  "Emerald",
  "Cobalt",
  "Crimson",
  "Brave",
  "Hyper",
  "Echo",
  "Turbo",
  "Radiant",
  "Lunar",
];

const NOUNS = [
  "Falcon",
  "Lynx",
  "Maverick",
  "Cheetah",
  "Phoenix",
  "Griffin",
  "Voyager",
  "Nomad",
  "Ranger",
  "Scout",
  "Hawk",
  "Tiger",
  "Panther",
  "Wolf",
  "Otter",
  "Badger",
  "Eagle",
  "Dragon",
  "Titan",
  "Knight",
  "Raider",
  "Spark",
  "Pilot",
  "Fox",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a cool, deterministic pseudonym for anonymous or unregistered users.
 * Example outputs: "Cosmic Falcon", "Shadow Lynx #429"
 */
export function getCoolName(userIdOrSeed?: string | null): string {
  if (!userIdOrSeed) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
  }

  const hash = hashString(userIdOrSeed);
  const adjIndex = hash % ADJECTIVES.length;
  const nounIndex = (Math.floor(hash / ADJECTIVES.length)) % NOUNS.length;
  const suffixNum = (hash % 899) + 100; // 3-digit number 100-999

  const adj = ADJECTIVES[adjIndex];
  const noun = NOUNS[nounIndex];

  return `${adj} ${noun} #${suffixNum}`;
}

/**
 * Returns a 2-character uppercase avatar abbreviation for a cool name or full name.
 * e.g. "Cosmic Falcon #429" -> "CF"
 */
export function getAvatarInitials(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return "YR";

  // If email
  if (nameOrEmail.includes("@")) {
    const userPart = nameOrEmail.split("@")[0];
    return userPart.slice(0, 2).toUpperCase();
  }

  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nameOrEmail.slice(0, 2).toUpperCase();
}
