from thefuzz import process
from typing import Optional, Tuple

# Seed Data Lists (As per Bhawana's task in the 48-hour plan)
VILLAGES = [
    "Nangal", "Taraori", "Nilokheri", "Indri", "Assandh", 
    "Nissing", "Gharaunda", "Nabha", "Rajpura", "Samana", 
    "Patran", "Sanaur", "Ghagga", "Karnal", "Patiala"
]

# Hindi translations mapped to English canonical names for matching
CROPS = {
    "Wheat": ["गेहूँ", "gehun", "wheat"],
    "Rice": ["धान", "चावल", "dhan", "chawal", "rice"],
    "Sugarcane": ["गन्ना", "ganna", "sugarcane"],
    "Mustard": ["सरसों", "sarson", "mustard"]
}

# Flatten crop aliases for fuzzy matching
CROP_ALIASES = []
CROP_MAPPING = {}
for canonical_name, aliases in CROPS.items():
    for alias in aliases:
        CROP_ALIASES.append(alias)
        CROP_MAPPING[alias] = canonical_name

def extract_village(spoken_text: str) -> Optional[str]:
    """
    Fuzzy match the spoken text against the known seed list of villages.
    """
    # In a real NLP pipeline, you'd extract nouns first. 
    # For a hackathon, we can try to see if any village name closely matches a word in the text.
    words = spoken_text.split()
    best_match = None
    highest_score = 0
    
    for word in words:
        # threshold of 80/100 to consider a match
        match, score = process.extractOne(word, VILLAGES)
        if score > highest_score and score >= 80:
            highest_score = score
            best_match = match
            
    return best_match

def extract_crop(spoken_text: str) -> Optional[str]:
    """
    Fuzzy match the spoken text against crop aliases to find the canonical crop name.
    """
    words = spoken_text.split()
    best_match_alias = None
    highest_score = 0
    
    for word in words:
        match, score = process.extractOne(word, CROP_ALIASES)
        if score > highest_score and score >= 80:
            highest_score = score
            best_match_alias = match
            
    if best_match_alias:
        return CROP_MAPPING[best_match_alias]
    return None

def parse_farmer_intent(spoken_text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse a Hindi/English mixed spoken phrase into structured data.
    E.g. "मेरा गाँव नांगल है, फसल गेहूँ है" -> ("Nangal", "Wheat")
    """
    village = extract_village(spoken_text)
    crop = extract_crop(spoken_text)
    
    return village, crop
