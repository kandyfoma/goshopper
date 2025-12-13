// OCR Text Correction Service
// Corrects common OCR errors in receipt text using pattern matching and AI-like corrections

interface CorrectionRule {
  pattern: RegExp;
  replacement: string;
  description?: string;
}

class OcrCorrectionService {
  private correctionRules: CorrectionRule[] = [
    // French food items with accents
    { pattern: /\boeufs?\b/gi, replacement: 'œufs', description: 'eggs' },
    { pattern: /\bcafé\b/gi, replacement: 'café', description: 'coffee' },
    { pattern: /\bcrème\b/gi, replacement: 'crème', description: 'cream' },
    { pattern: /\bfromage\b/gi, replacement: 'fromage', description: 'cheese' },
    { pattern: /\blait\b/gi, replacement: 'lait', description: 'milk' },
    { pattern: /\bpain\b/gi, replacement: 'pain', description: 'bread' },
    { pattern: /\bviande\b/gi, replacement: 'viande', description: 'meat' },
    { pattern: /\bpoisson\b/gi, replacement: 'poisson', description: 'fish' },
    { pattern: /\blégumes?\b/gi, replacement: 'légumes', description: 'vegetables' },
    { pattern: /\bfruits?\b/gi, replacement: 'fruits', description: 'fruits' },
    { pattern: /\bsaucisse\b/gi, replacement: 'saucisse', description: 'sausage' },
    { pattern: /\bsaucisson\b/gi, replacement: 'saucisson', description: 'saucisson' },
    { pattern: /\bcharcuterie\b/gi, replacement: 'charcuterie', description: 'deli meats' },
    { pattern: /\bépicerie\b/gi, replacement: 'épicerie', description: 'grocery' },
    { pattern: /\bboisson\b/gi, replacement: 'boisson', description: 'drink' },
    { pattern: /\bdessert\b/gi, replacement: 'dessert', description: 'dessert' },
    { pattern: /\bglace\b/gi, replacement: 'glace', description: 'ice cream' },
    { pattern: /\bchocolat\b/gi, replacement: 'chocolat', description: 'chocolate' },
    { pattern: /\bbière\b/gi, replacement: 'bière', description: 'beer' },
    { pattern: /\bvin\b/gi, replacement: 'vin', description: 'wine' },

    // Common OCR misreads
    { pattern: /\b(0|o|Q|O)\s*(\d+)/gi, replacement: '0$2', description: 'zero prefix' },
    { pattern: /\b1\s*(\d{2,})/gi, replacement: '1$1', description: 'one prefix' },
    { pattern: /\b2\s*(\d{2,})/gi, replacement: '2$1', description: 'two prefix' },
    { pattern: /\b3\s*(\d{2,})/gi, replacement: '3$1', description: 'three prefix' },
    { pattern: /\b4\s*(\d{2,})/gi, replacement: '4$1', description: 'four prefix' },
    { pattern: /\b5\s*(\d{2,})/gi, replacement: '5$1', description: 'five prefix' },
    { pattern: /\b6\s*(\d{2,})/gi, replacement: '6$1', description: 'six prefix' },
    { pattern: /\b7\s*(\d{2,})/gi, replacement: '7$1', description: 'seven prefix' },
    { pattern: /\b8\s*(\d{2,})/gi, replacement: '8$1', description: 'eight prefix' },
    { pattern: /\b9\s*(\d{2,})/gi, replacement: '9$1', description: 'nine prefix' },

    // Common brand names and products
    { pattern: /\bcoca\s*cola\b/gi, replacement: 'Coca-Cola', description: 'Coca-Cola' },
    { pattern: /\bpepsi\b/gi, replacement: 'Pepsi', description: 'Pepsi' },
    { pattern: /\bnutella\b/gi, replacement: 'Nutella', description: 'Nutella' },
    { pattern: /\bnestlé\b/gi, replacement: 'Nestlé', description: 'Nestlé' },
    { pattern: /\bdanone\b/gi, replacement: 'Danone', description: 'Danone' },
    { pattern: /\byoplait\b/gi, replacement: 'Yoplait', description: 'Yoplait' },
    { pattern: /\bactivia\b/gi, replacement: 'Activia', description: 'Activia' },
    { pattern: /\bpringles\b/gi, replacement: 'Pringles', description: 'Pringles' },
    { pattern: /\blays\b/gi, replacement: 'Lays', description: 'Lays' },
    { pattern: /\bdoritos\b/gi, replacement: 'Doritos', description: 'Doritos' },

    // Units and measurements
    { pattern: /\b(\d+)\s*kg\b/gi, replacement: '$1 kg', description: 'kilograms' },
    { pattern: /\b(\d+)\s*g\b/gi, replacement: '$1 g', description: 'grams' },
    { pattern: /\b(\d+)\s*mg\b/gi, replacement: '$1 mg', description: 'milligrams' },
    { pattern: /\b(\d+)\s*l\b/gi, replacement: '$1 L', description: 'liters' },
    { pattern: /\b(\d+)\s*ml\b/gi, replacement: '$1 mL', description: 'milliliters' },
    { pattern: /\b(\d+)\s*cl\b/gi, replacement: '$1 cL', description: 'centiliters' },

    // Common Congolese products
    { pattern: /\bprimus\b/gi, replacement: 'Primus', description: 'Primus beer' },
    { pattern: /\bskodas?\b/gi, replacement: 'Skol', description: 'Skol beer' },
    { pattern: /\btuborg\b/gi, replacement: 'Tuborg', description: 'Tuborg beer' },
    { pattern: /\bmützig\b/gi, replacement: 'Mützig', description: 'Mützig beer' },
    { pattern: /\bcastel\b/gi, replacement: 'Castel', description: 'Castel beer' },
    { pattern: /\bbrasseries?\b/gi, replacement: 'Brasserie', description: 'brewery' },
    { pattern: /\bfriandise\b/gi, replacement: 'friandise', description: 'candy' },
    { pattern: /\bconfiserie\b/gi, replacement: 'confiserie', description: 'confectionery' },
  ];

  /**
   * Correct OCR text using pattern matching
   */
  correctText(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let correctedText = text;

    // Apply all correction rules
    for (const rule of this.correctionRules) {
      correctedText = correctedText.replace(rule.pattern, rule.replacement);
    }

    // Additional corrections for common OCR issues
    correctedText = this.applyAdditionalCorrections(correctedText);

    return correctedText;
  }

  /**
   * Apply additional corrections that require more complex logic
   */
  private applyAdditionalCorrections(text: string): string {
    let corrected = text;

    // Fix common letter substitutions
    const letterFixes: Record<string, string> = {
      '0': 'o',
      '1': 'l',
      '2': 'z',
      '3': 'e',
      '4': 'a',
      '5': 's',
      '6': 'g',
      '7': 't',
      '8': 'b',
      '9': 'g',
      'Q': 'o',
      'O': 'o',
      'I': 'l',
      'l': 'l',
      'Z': 'z',
      'E': 'e',
      'A': 'a',
      'S': 's',
      'G': 'g',
      'T': 't',
      'B': 'b',
    };

    // Context-aware corrections (only in specific positions)
    corrected = corrected.replace(/\b([0-9QOIlZEASGTB])\w+\b/g, (match) => {
      const firstChar = match.charAt(0);
      const replacement = letterFixes[firstChar];
      if (replacement && match.length > 1) {
        return replacement + match.substring(1);
      }
      return match;
    });

    // Fix spacing issues
    corrected = corrected.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space between camelCase
    corrected = corrected.replace(/\s+/g, ' '); // Normalize multiple spaces
    corrected = corrected.trim();

    return corrected;
  }

  /**
   * Correct product names specifically
   */
  correctProductName(name: string): string {
    if (!name) return name;

    // First apply general corrections
    let corrected = this.correctText(name);

    // Product-specific corrections
    const productCorrections: Record<string, string> = {
      'deufs': 'œufs',
      'oeuf': 'œuf',
      'frommage': 'fromage',
      'laitt': 'lait',
      'painn': 'pain',
      'viand': 'viande',
      'poissonn': 'poisson',
      'legumes': 'légumes',
      'fruit': 'fruits',
      'saucisse': 'saucisse',
      'charcuterie': 'charcuterie',
      'boissonn': 'boisson',
      'dessertt': 'dessert',
      'glacce': 'glace',
      'chocolatt': 'chocolat',
      'biere': 'bière',
      'vinn': 'vin',
      'cafe': 'café',
      'creme': 'crème',
    };

    // Check for exact matches first
    const lowerName = corrected.toLowerCase();
    if (productCorrections[lowerName]) {
      return productCorrections[lowerName];
    }

    // Apply fuzzy matching for similar words
    for (const [wrong, correct] of Object.entries(productCorrections)) {
      if (this.levenshteinDistance(lowerName, wrong) <= 2) {
        return correct;
      }
    }

    return corrected;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Add custom correction rule
   */
  addCorrectionRule(pattern: RegExp, replacement: string, description?: string): void {
    this.correctionRules.push({ pattern, replacement, description });
  }

  /**
   * Get all correction rules for debugging
   */
  getCorrectionRules(): CorrectionRule[] {
    return [...this.correctionRules];
  }
}

export const ocrCorrectionService = new OcrCorrectionService();