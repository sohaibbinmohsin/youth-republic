/**
 * Curated datasets and similarity search functions for Institution, City, Province, and Country.
 */

export interface AutocompleteItem {
  id: string;
  label: string;
  secondary?: string;
  aliases?: string[];
}

export const PAKISTAN_PROVINCES: AutocompleteItem[] = [
  { id: "punjab", label: "Punjab" },
  { id: "sindh", label: "Sindh" },
  { id: "khyber_pakhtunkhwa", label: "Khyber Pakhtunkhwa", aliases: ["KPK", "KP"] },
  { id: "balochistan", label: "Balochistan", aliases: ["Baluchistan"] },
  { id: "islamabad", label: "Islamabad Capital Territory", aliases: ["ICT", "Islamabad"] },
  { id: "gilgit_baltistan", label: "Gilgit-Baltistan", aliases: ["GB"] },
  { id: "azad_kashmir", label: "Azad Jammu and Kashmir", aliases: ["AJK", "Azad Kashmir"] },
];

export const COUNTRIES: AutocompleteItem[] = [
  { id: "pk", label: "Pakistan" },
  { id: "ae", label: "United Arab Emirates", aliases: ["UAE", "Dubai", "Abu Dhabi"] },
  { id: "sa", label: "Saudi Arabia", aliases: ["KSA"] },
  { id: "uk", label: "United Kingdom", aliases: ["UK", "Britain", "England", "Scotland", "Wales"] },
  { id: "us", label: "United States", aliases: ["USA", "America"] },
  { id: "ca", label: "Canada" },
  { id: "au", label: "Australia" },
  { id: "qa", label: "Qatar" },
  { id: "om", label: "Oman" },
  { id: "kw", label: "Kuwait" },
  { id: "bh", label: "Bahrain" },
  { id: "my", label: "Malaysia" },
  { id: "sg", label: "Singapore" },
  { id: "tr", label: "Turkey", aliases: ["Türkiye"] },
  { id: "de", label: "Germany" },
  { id: "fr", label: "France" },
  { id: "it", label: "Italy" },
  { id: "cn", label: "China" },
  { id: "jp", label: "Japan" },
  { id: "in", label: "India" },
  { id: "bd", label: "Bangladesh" },
  { id: "lk", label: "Sri Lanka" },
  { id: "nl", label: "Netherlands", aliases: ["Holland"] },
  { id: "se", label: "Sweden" },
  { id: "no", label: "Norway" },
  { id: "ch", label: "Switzerland" },
  { id: "ie", label: "Ireland" },
  { id: "nz", label: "New Zealand" },
];

export const CITIES: AutocompleteItem[] = [
  // Major Pakistani Cities
  { id: "lahore", label: "Lahore", secondary: "Punjab" },
  { id: "karachi", label: "Karachi", secondary: "Sindh" },
  { id: "islamabad", label: "Islamabad", secondary: "Federal Capital" },
  { id: "rawalpindi", label: "Rawalpindi", secondary: "Punjab" },
  { id: "faisalabad", label: "Faisalabad", secondary: "Punjab", aliases: ["Lyallpur"] },
  { id: "multan", label: "Multan", secondary: "Punjab" },
  { id: "peshawar", label: "Peshawar", secondary: "Khyber Pakhtunkhwa" },
  { id: "quetta", label: "Quetta", secondary: "Balochistan" },
  { id: "sialkot", label: "Sialkot", secondary: "Punjab" },
  { id: "gujranwala", label: "Gujranwala", secondary: "Punjab" },
  { id: "hyderabad", label: "Hyderabad", secondary: "Sindh" },
  { id: "abbottabad", label: "Abbottabad", secondary: "Khyber Pakhtunkhwa" },
  { id: "bahawalpur", label: "Bahawalpur", secondary: "Punjab" },
  { id: "sargodha", label: "Sargodha", secondary: "Punjab" },
  { id: "sukkur", label: "Sukkur", secondary: "Sindh" },
  { id: "larkana", label: "Larkana", secondary: "Sindh" },
  { id: "sheikhupura", label: "Sheikhupura", secondary: "Punjab" },
  { id: "jhang", label: "Jhang", secondary: "Punjab" },
  { id: "rahim_yar_khan", label: "Rahim Yar Khan", secondary: "Punjab", aliases: ["RYK"] },
  { id: "gujrat", label: "Gujrat", secondary: "Punjab" },
  { id: "mardan", label: "Mardan", secondary: "Khyber Pakhtunkhwa" },
  { id: "kasur", label: "Kasur", secondary: "Punjab" },
  { id: "sahiwal", label: "Sahiwal", secondary: "Punjab", aliases: ["Montgomery"] },
  { id: "okara", label: "Okara", secondary: "Punjab" },
  { id: "wah_cantt", label: "Wah Cantt", secondary: "Punjab", aliases: ["Wah"] },
  { id: "dera_ghazi_khan", label: "Dera Ghazi Khan", secondary: "Punjab", aliases: ["DG Khan"] },
  { id: "mirpur", label: "Mirpur", secondary: "Azad Kashmir" },
  { id: "muzaffarabad", label: "Muzaffarabad", secondary: "Azad Kashmir" },
  { id: "gilgit", label: "Gilgit", secondary: "Gilgit-Baltistan" },
  { id: "skardu", label: "Skardu", secondary: "Gilgit-Baltistan" },
  { id: "gwadar", label: "Gwadar", secondary: "Balochistan" },
  { id: "turbat", label: "Turbat", secondary: "Balochistan" },
  { id: "khuzdar", label: "Khuzdar", secondary: "Balochistan" },
  { id: "swat", label: "Swat", secondary: "Khyber Pakhtunkhwa", aliases: ["Mingora"] },
  { id: "dera_ismail_khan", label: "Dera Ismail Khan", secondary: "Khyber Pakhtunkhwa", aliases: ["DI Khan"] },
  { id: "kohat", label: "Kohat", secondary: "Khyber Pakhtunkhwa" },
  { id: "bannu", label: "Bannu", secondary: "Khyber Pakhtunkhwa" },
  { id: "chiniot", label: "Chiniot", secondary: "Punjab" },
  { id: "kamoke", label: "Kamoke", secondary: "Punjab" },
  { id: "hafizabad", label: "Hafizabad", secondary: "Punjab" },
  { id: "burewala", label: "Burewala", secondary: "Punjab" },
  { id: "khanewal", label: "Khanewal", secondary: "Punjab" },
  { id: "muzaffargarh", label: "Muzaffargarh", secondary: "Punjab" },
  { id: "mandi_bahauddin", label: "Mandi Bahauddin", secondary: "Punjab" },
  { id: "jhelum", label: "Jhelum", secondary: "Punjab" },
  { id: "chakwal", label: "Chakwal", secondary: "Punjab" },
  { id: "attock", label: "Attock", secondary: "Punjab" },
  { id: "vehari", label: "Vehari", secondary: "Punjab" },
  { id: "nawabshah", label: "Nawabshah", secondary: "Sindh", aliases: ["Shaheed Benazirabad"] },
  { id: "mirpur_khas", label: "Mirpur Khas", secondary: "Sindh" },
  { id: "jacobabad", label: "Jacobabad", secondary: "Sindh" },
  { id: "shikarpur", label: "Shikarpur", secondary: "Sindh" },
  { id: "khairpur", label: "Khairpur", secondary: "Sindh" },
  // Major International Hubs
  { id: "dubai", label: "Dubai", secondary: "UAE" },
  { id: "abu_dhabi", label: "Abu Dhabi", secondary: "UAE" },
  { id: "riyadh", label: "Riyadh", secondary: "Saudi Arabia" },
  { id: "jeddah", label: "Jeddah", secondary: "Saudi Arabia" },
  { id: "doha", label: "Doha", secondary: "Qatar" },
  { id: "london", label: "London", secondary: "UK" },
  { id: "new_york", label: "New York", secondary: "USA" },
  { id: "toronto", label: "Toronto", secondary: "Canada" },
];

export const INSTITUTIONS: AutocompleteItem[] = [
  // Top Pakistani Universities & Higher Education
  { id: "pu", label: "University of the Punjab", secondary: "Lahore", aliases: ["Punjab University", "PU", "PUCIT"] },
  { id: "lums", label: "Lahore University of Management Sciences", secondary: "Lahore", aliases: ["LUMS"] },
  { id: "nust", label: "National University of Sciences and Technology", secondary: "Islamabad", aliases: ["NUST", "SEECS", "SMME", "NBS"] },
  { id: "fast_isb", label: "FAST National University of Computer and Emerging Sciences", secondary: "Islamabad", aliases: ["FAST", "FAST NUCES", "NUCES", "FAST Islamabad"] },
  { id: "fast_lhr", label: "FAST National University of Computer and Emerging Sciences", secondary: "Lahore", aliases: ["FAST Lahore", "FAST CFD", "FAST-NU"] },
  { id: "fast_khi", label: "FAST National University of Computer and Emerging Sciences", secondary: "Karachi", aliases: ["FAST Karachi"] },
  { id: "giki", label: "Ghulam Ishaq Khan Institute of Engineering Sciences and Technology", secondary: "Topi, Swabi", aliases: ["GIKI", "GIK Institute"] },
  { id: "iba_khi", label: "Institute of Business Administration", secondary: "Karachi", aliases: ["IBA", "IBA Karachi"] },
  { id: "iba_suk", label: "Sukkur IBA University", secondary: "Sukkur", aliases: ["Sukkur IBA", "SIBA"] },
  { id: "comsats_isb", label: "COMSATS University Islamabad", secondary: "Islamabad", aliases: ["COMSATS", "CUI"] },
  { id: "comsats_lhr", label: "COMSATS University Lahore", secondary: "Lahore", aliases: ["COMSATS Lahore"] },
  { id: "uet_lhr", label: "University of Engineering and Technology", secondary: "Lahore", aliases: ["UET", "UET Lahore"] },
  { id: "uet_psh", label: "University of Engineering and Technology", secondary: "Peshawar", aliases: ["UET Peshawar"] },
  { id: "uet_tax", label: "University of Engineering and Technology", secondary: "Taxila", aliases: ["UET Taxila"] },
  { id: "ned", label: "NED University of Engineering and Technology", secondary: "Karachi", aliases: ["NED", "NED University"] },
  { id: "qau", label: "Quaid-i-Azam University", secondary: "Islamabad", aliases: ["QAU", "Quaid e Azam University"] },
  { id: "aku", label: "Aga Khan University", secondary: "Karachi", aliases: ["AKU", "Aga Khan"] },
  { id: "itu", label: "Information Technology University", secondary: "Lahore", aliases: ["ITU", "ITU Lahore"] },
  { id: "uok", label: "University of Karachi", secondary: "Karachi", aliases: ["KU", "Karachi University", "UoK"] },
  { id: "uop", label: "University of Peshawar", secondary: "Peshawar", aliases: ["UoP", "Peshawar University"] },
  { id: "uob", label: "University of Balochistan", secondary: "Quetta", aliases: ["UoB"] },
  { id: "kemu", label: "King Edward Medical University", secondary: "Lahore", aliases: ["KEMU", "King Edward"] },
  { id: "aimc", label: "Allama Iqbal Medical College", secondary: "Lahore", aliases: ["AIMC"] },
  { id: "fjmu", label: "Fatima Jinnah Medical University", secondary: "Lahore", aliases: ["FJMU"] },
  { id: "rmu", label: "Rawalpindi Medical University", secondary: "Rawalpindi", aliases: ["RMU", "RMC"] },
  { id: "duhs", label: "Dow University of Health Sciences", secondary: "Karachi", aliases: ["DUHS", "Dow Medical"] },
  { id: "kinnaird", label: "Kinnaird College for Women", secondary: "Lahore", aliases: ["Kinnaird", "KC"] },
  { id: "lse", label: "Lahore School of Economics", secondary: "Lahore", aliases: ["LSE"] },
  { id: "habib", label: "Habib University", secondary: "Karachi", aliases: ["Habib", "HU"] },
  { id: "bnu", label: "Beaconhouse National University", secondary: "Lahore", aliases: ["BNU"] },
  { id: "fccu", label: "Forman Christian College University", secondary: "Lahore", aliases: ["FCCU", "FC College"] },
  { id: "gcu_lhr", label: "Government College University", secondary: "Lahore", aliases: ["GCU", "GCU Lahore", "GC University"] },
  { id: "gcu_fsd", label: "Government College University Faisalabad", secondary: "Faisalabad", aliases: ["GCUF"] },
  { id: "nca", label: "National College of Arts", secondary: "Lahore", aliases: ["NCA"] },
  { id: "pieas", label: "Pakistan Institute of Engineering and Applied Sciences", secondary: "Islamabad", aliases: ["PIEAS"] },
  { id: "bahria", label: "Bahria University", secondary: "Islamabad / Karachi / Lahore", aliases: ["BU", "Bahria"] },
  { id: "air", label: "Air University", secondary: "Islamabad", aliases: ["AU", "Air"] },
  { id: "szabist", label: "SZABIST University", secondary: "Karachi / Islamabad", aliases: ["SZABIST"] },
  { id: "ucp", label: "University of Central Punjab", secondary: "Lahore", aliases: ["UCP"] },
  { id: "umt", label: "University of Management and Technology", secondary: "Lahore", aliases: ["UMT"] },
  { id: "uol", label: "The University of Lahore", secondary: "Lahore", aliases: ["UOL", "Univ of Lahore"] },
  { id: "riphah", label: "Riphah International University", secondary: "Islamabad / Lahore", aliases: ["Riphah"] },
  { id: "superior", label: "The Superior University", secondary: "Lahore", aliases: ["Superior"] },
  { id: "iqra", label: "Iqra University", secondary: "Karachi / Islamabad", aliases: ["IU", "Iqra"] },
  { id: "nueml", label: "National University of Modern Languages", secondary: "Islamabad", aliases: ["NUML"] },
  { id: "aiou", label: "Allama Iqbal Open University", secondary: "Islamabad", aliases: ["AIOU"] },
  { id: "iub", label: "The Islamia University of Bahawalpur", secondary: "Bahawalpur", aliases: ["IUB"] },
  { id: "bzu", label: "Bahauddin Zakariya University", secondary: "Multan", aliases: ["BZU"] },
  { id: "uaf", label: "University of Agriculture Faisalabad", secondary: "Faisalabad", aliases: ["UAF"] },
  { id: "pmas", label: "Pir Mehr Ali Shah Arid Agriculture University", secondary: "Rawalpindi", aliases: ["Arid Agriculture", "PMAS"] },
  { id: "kust", label: "Kohat University of Science and Technology", secondary: "Kohat", aliases: ["KUST"] },
  { id: "ustb", label: "University of Science and Technology Bannu", secondary: "Bannu", aliases: ["USTB"] },
  { id: "buitems", label: "Balochistan University of Information Technology, Engineering and Management Sciences", secondary: "Quetta", aliases: ["BUITEMS"] },
  { id: "kiu", label: "Karakoram International University", secondary: "Gilgit", aliases: ["KIU"] },
  { id: "must", label: "Mirpur University of Science and Technology", secondary: "Mirpur AJK", aliases: ["MUST"] },
  { id: "ajku", label: "University of Azad Jammu and Kashmir", secondary: "Muzaffarabad", aliases: ["UAJK", "AJKU"] },
  { id: "roots", label: "Roots Millennium / IVY College", secondary: "Pakistan", aliases: ["Roots", "IVY"] },
  { id: "tmuc", label: "The Millennium Universal College", secondary: "Pakistan", aliases: ["TMUC"] },
  { id: "tns", label: "TNS Beaconhouse / Beaconhouse School System", secondary: "Pakistan", aliases: ["Beaconhouse", "BSS"] },
  { id: "lgs", label: "Lahore Grammar School", secondary: "Pakistan", aliases: ["LGS"] },
  { id: "froebels", label: "Froebel's International School", secondary: "Pakistan", aliases: ["Froebels"] },
  { id: "aitchison", label: "Aitchison College", secondary: "Lahore", aliases: ["Aitchison"] },
  { id: "karachi_grammar", label: "Karachi Grammar School", secondary: "Karachi", aliases: ["KGS"] },
];

/**
 * Searches and ranks items based on query similarity.
 */
export function searchSimilarItems(query: string, items: AutocompleteItem[], limit = 6): AutocompleteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: { item: AutocompleteItem; score: number }[] = [];

  for (const item of items) {
    const labelLower = item.label.toLowerCase();
    const secondaryLower = (item.secondary || "").toLowerCase();
    const aliases = item.aliases || [];

    // Exact label match
    if (labelLower === q) {
      results.push({ item, score: 100 });
      continue;
    }

    // Alias exact match (e.g. "lums" === "LUMS", "fast" === "FAST")
    const hasExactAlias = aliases.some((a) => a.toLowerCase() === q);
    if (hasExactAlias) {
      results.push({ item, score: 95 });
      continue;
    }

    // Starts with query
    if (labelLower.startsWith(q)) {
      results.push({ item, score: 85 - (labelLower.length - q.length) * 0.1 });
      continue;
    }

    // Word boundary start (e.g. "Punjab" in "University of the Punjab")
    const words = labelLower.split(/\s+/);
    const wordStarts = words.some((w) => w.startsWith(q));
    if (wordStarts) {
      results.push({ item, score: 75 });
      continue;
    }

    // Alias prefix match
    const aliasStarts = aliases.some((a) => a.toLowerCase().startsWith(q));
    if (aliasStarts) {
      results.push({ item, score: 70 });
      continue;
    }

    // Contains query in label
    if (labelLower.includes(q)) {
      results.push({ item, score: 50 });
      continue;
    }

    // Alias contains query
    const aliasContains = aliases.some((a) => a.toLowerCase().includes(q));
    if (aliasContains) {
      results.push({ item, score: 40 });
      continue;
    }

    // Secondary matches (e.g. typing "Lahore" matches institutions in Lahore)
    if (secondaryLower && (secondaryLower.startsWith(q) || secondaryLower.includes(q))) {
      results.push({ item, score: 30 });
      continue;
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item);
}
