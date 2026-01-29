// Natural Language Query Service
// AI-powered conversational queries about spending and receipts
import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from './config';
import {safeToDate} from '@/shared/utils/helpers';

const RECEIPTS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/receipts`;

export interface QueryResult {
  answer: string;
  answerLingala?: string;
  data?: any;
  suggestions?: string[];
  chartData?: ChartData;
  type: QueryResultType;
}

export type QueryResultType =
  | 'spending_summary'
  | 'category_breakdown'
  | 'store_comparison'
  | 'item_search'
  | 'price_trend'
  | 'budget_status'
  | 'general';

export interface ChartData {
  type: 'bar' | 'pie' | 'line';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    colors?: string[];
  }[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentLingala?: string;
  timestamp: Date;
  data?: any;
}

// Query patterns for local processing
const QUERY_PATTERNS = {
  spending: {
    patterns: [
      /combien.*d[ée]pens[ée]/i,
      /how much.*spent/i,
      /total.*spent/i,
      /mes d[ée]penses/i,
      /mbongo boni/i, // Lingala
    ],
    type: 'spending_summary' as QueryResultType,
  },
  category: {
    patterns: [
      /d[ée]pens.*cat[ée]gorie/i,
      /d[ée]pens.*(?:nourriture|alimentation|food)/i,
      /d[ée]pens.*(?:transport|boissons|hygi[eè]ne)/i,
      /spending.*category/i,
      /bilei|kombo/i, // Lingala for food
    ],
    type: 'category_breakdown' as QueryResultType,
  },
  store: {
    patterns: [
      /quel.*magasin/i,
      /meilleur.*prix/i,
      /which store/i,
      /best price/i,
      /o[uù] acheter/i,
      /wapi/i, // Lingala for where
    ],
    type: 'store_comparison' as QueryResultType,
  },
  item: {
    patterns: [
      /prix.*(?:de|du|des)\s+(\w+)/i,
      /price.*of\s+(\w+)/i,
      /combien.*co[uû]te/i,
      /how much.*cost/i,
      /ntalo ya/i, // Lingala for price of
    ],
    type: 'item_search' as QueryResultType,
  },
  trend: {
    patterns: [
      /[ée]volution/i,
      /tendance/i,
      /historique/i,
      /trend/i,
      /over time/i,
    ],
    type: 'price_trend' as QueryResultType,
  },
};

class NaturalLanguageService {
  private conversationHistory: ConversationMessage[] = [];

  /**
   * Process a natural language query
   */
  async processQuery(
    userId: string,
    query: string,
    useCloud = false,
  ): Promise<QueryResult> {
    // Add to conversation history
    this.addMessage('user', query);

    // Detect query type
    const queryType = this.detectQueryType(query);

    let result: QueryResult;

    if (useCloud) {
      // Use Cloud Function for complex AI processing
      result = await this.processWithAI(userId, query);
    } else {
      // Process locally for common queries
      result = await this.processLocally(userId, query, queryType);
    }

    // Add response to history
    this.addMessage('assistant', result.answer, result.answerLingala);

    return result;
  }

  /**
   * Detect query type from natural language
   */
  private detectQueryType(query: string): QueryResultType {
    for (const [, config] of Object.entries(QUERY_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(query)) {
          return config.type;
        }
      }
    }
    return 'general';
  }

  /**
   * Extract time period from query
   */
  private extractTimePeriod(query: string): {
    start: Date;
    end: Date;
    label: string;
  } {
    const now = new Date();
    const queryLower = query.toLowerCase();

    // This month
    if (
      queryLower.includes('ce mois') ||
      queryLower.includes('this month') ||
      queryLower.includes('sanza oyo')
    ) {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now,
        label: 'ce mois',
      };
    }

    // Last month
    if (
      queryLower.includes('mois dernier') ||
      queryLower.includes('last month') ||
      queryLower.includes('sanza eleki')
    ) {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        start: lastMonth,
        end: new Date(now.getFullYear(), now.getMonth(), 0),
        label: 'le mois dernier',
      };
    }

    // This week
    if (
      queryLower.includes('cette semaine') ||
      queryLower.includes('this week') ||
      queryLower.includes('poso oyo')
    ) {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      return {
        start: startOfWeek,
        end: now,
        label: 'cette semaine',
      };
    }

    // Today
    if (
      queryLower.includes('aujourd') ||
      queryLower.includes('today') ||
      queryLower.includes('lelo')
    ) {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      return {
        start: startOfDay,
        end: now,
        label: "aujourd'hui",
      };
    }

    // Default to this month
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
      label: 'ce mois',
    };
  }

  /**
   * Extract category from query
   */
  private extractCategory(query: string): string | null {
    const categories: {[key: string]: string[]} = {
      Alimentation: ['nourriture', 'food', 'manger', 'bilei', 'alimentation'],
      Boissons: ['boissons', 'drinks', 'bière', 'eau', 'masanga'],
      Transport: ['transport', 'taxi', 'bus', 'carburant'],
      Hygiène: ['hygiène', 'hygiene', 'savon', 'proprete'],
      Ménage: ['ménage', 'maison', 'household', 'ndako'],
    };

    const queryLower = query.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) {
          return category;
        }
      }
    }

    return null;
  }

  /**
   * Process query locally (without AI) - Enhanced fallback
   */
  private async processLocally(
    userId: string,
    query: string,
    queryType: QueryResultType,
  ): Promise<QueryResult> {
    const timePeriod = this.extractTimePeriod(query);

    // First try to get some basic spending data
    try {
      const basicData = await this.getBasicSpendingData(userId, timePeriod);

      // If we have data, provide a more intelligent response
      if (basicData.totalSpent > 0) {
        return this.generateIntelligentResponse(query, queryType, timePeriod, basicData);
      }
    } catch (error) {
      console.warn('Failed to get basic spending data:', error);
    }

    // Fallback to pattern-based responses
    switch (queryType) {
      case 'spending_summary':
        return this.getSpendingSummary(userId, timePeriod);
      case 'category_breakdown':
        const category = this.extractCategory(query);
        return this.getCategoryBreakdown(userId, timePeriod, category);
      case 'store_comparison':
        return this.getStoreComparison(userId, timePeriod);
      case 'item_search':
        const itemMatch = query.match(/(?:prix|price|ntalo).*?(\w+)/i);
        const itemName = itemMatch ? itemMatch[1] : '';
        return this.searchItemPrices(userId, itemName);
      default:
        return this.generateGeneralResponse(query);
    }
  }

  /**
   * Get basic spending data for intelligent responses
   */
  private async getBasicSpendingData(
    userId: string,
    period: {start: Date; end: Date; label: string},
  ): Promise<{
    totalSpent: number;
    receiptCount: number;
    topCategory: string;
    topStore: string;
    avgPerReceipt: number;
  }> {
    const broaderStart = new Date(period.start);
    broaderStart.setMonth(broaderStart.getMonth() - 1);

    const snapshot = await firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .where('scannedAt', '>=', broaderStart)
      .orderBy('scannedAt', 'desc')
      .get();

    let totalSpent = 0;
    let receiptCount = 0;
    const categories: {[key: string]: number} = {};
    const stores: {[key: string]: number} = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const scannedAt = safeToDate(data.scannedAt);

      if (scannedAt >= period.start && scannedAt <= period.end) {
        totalSpent += data.total || 0;
        receiptCount++;

        const store = data.storeName || 'Inconnu';
        stores[store] = (stores[store] || 0) + (data.total || 0);

        (data.items || []).forEach((item: any) => {
          const cat = item.category || 'Autres';
          categories[cat] = (categories[cat] || 0) + (item.unitPrice * item.quantity);
        });
      }
    });

    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Aucune';
    const topStore = Object.entries(stores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Aucun';
    const avgPerReceipt = receiptCount > 0 ? totalSpent / receiptCount : 0;

    return {
      totalSpent,
      receiptCount,
      topCategory,
      topStore,
      avgPerReceipt,
    };
  }

  /**
   * Generate intelligent response based on query and available data
   */
  private generateIntelligentResponse(
    query: string,
    queryType: QueryResultType,
    period: {start: Date; end: Date; label: string},
    data: {
      totalSpent: number;
      receiptCount: number;
      topCategory: string;
      topStore: string;
      avgPerReceipt: number;
    },
  ): QueryResult {
    const { totalSpent, receiptCount, topCategory, topStore, avgPerReceipt } = data;

    // Analyze query intent and provide contextual response
    const queryLower = query.toLowerCase();

    if (queryLower.includes('combien') || queryLower.includes('how much') || queryLower.includes('mbongo boni')) {
      return {
        answer: `${period.label}, vous avez dépensé $${totalSpent.toFixed(2)} sur ${receiptCount} achats. Votre catégorie principale est "${topCategory}" et vous magasinez surtout chez "${topStore}".`,
        answerLingala: `Na ${period.label}, olekisi $${totalSpent.toFixed(2)} na biloko ${receiptCount}. Eloko oyo olekaka mingi ezali "${topCategory}" mpe ozali kosomba mingi na "${topStore}".`,
        data: {
          totalSpent,
          receiptCount,
          topCategory,
          topStore,
          period: period.label,
        },
        suggestions: [
          `Détails ${topCategory}`,
          `Prix chez ${topStore}`,
          'Comparer avec le mois dernier',
        ],
        type: 'spending_summary',
      };
    }

    if (queryLower.includes('magasin') || queryLower.includes('store') || queryLower.includes('où')) {
      return {
        answer: `Vous magasinez principalement chez "${topStore}" où vous avez dépensé le plus ${period.label}. La moyenne par visite est de $${avgPerReceipt.toFixed(2)}.`,
        answerLingala: `Ozali kosomba mingi na "${topStore}" wapi olekisi mbongo mingi ${period.label}. Moyenne na visite ezali $${avgPerReceipt.toFixed(2)}.`,
        data: {
          topStore,
          avgPerReceipt,
          period: period.label,
        },
        suggestions: [
          `Prix chez ${topStore}`,
          'Comparer les magasins',
          'Meilleurs prix disponibles',
        ],
        type: 'store_comparison',
      };
    }

    if (queryLower.includes('catégorie') || queryLower.includes('category') || queryLower.includes('bilei')) {
      return {
        answer: `Votre plus grosse dépense ${period.label} est dans la catégorie "${topCategory}". Vous avez fait ${receiptCount} achats pour un total de $${totalSpent.toFixed(2)}.`,
        answerLingala: `Mbongo oyo olekisi mingi ${period.label} ezali na catégorie "${topCategory}". Osombi biloko ${receiptCount} na total $${totalSpent.toFixed(2)}.`,
        data: {
          topCategory,
          totalSpent,
          receiptCount,
          period: period.label,
        },
        suggestions: [
          `Détails ${topCategory}`,
          'Voir toutes les catégories',
          'Évolution des dépenses',
        ],
        type: 'category_breakdown',
      };
    }

    // General helpful response
    return {
      answer: `Basé sur vos données ${period.label}, vous avez dépensé $${totalSpent.toFixed(2)} en ${receiptCount} achats. Votre catégorie principale est "${topCategory}" et vous préférez "${topStore}". Que voulez-vous savoir d'autre ?`,
      answerLingala: `Na données na yo ${period.label}, olekisi $${totalSpent.toFixed(2)} na biloko ${receiptCount}. Catégorie ya yo mingi ezali "${topCategory}" mpe ozali kosomba na "${topStore}". Nini mosusu olingi koyeba?`,
      data: {
        totalSpent,
        receiptCount,
        topCategory,
        topStore,
        period: period.label,
      },
      suggestions: [
        'Mes dépenses détaillées',
        'Comparer les prix',
        'Conseils d\'économie',
      ],
      type: 'general',
    };
  }

  /**
   * Generate general response for unrecognized queries
   */
  private generateGeneralResponse(query: string): QueryResult {
    // Try to understand the query and provide helpful suggestions
    const queryLower = query.toLowerCase();

    if (queryLower.includes('prix') || queryLower.includes('price') || queryLower.includes('ntalo')) {
      return {
        answer: "Je peux vous aider à trouver les meilleurs prix ! Essayez de me demander le prix d'un article spécifique comme 'prix du riz' ou 'combien coûte le sucre'.",
        answerLingala: 'Nakoki kosunga yo na kozwa ntalo ya malamu! Meka kotuna ntalo ya eloko ndakisa ndenge "ntalo ya loso" to "sukari ezali ntalo boni".',
        suggestions: [
          'Prix du riz',
          'Prix du sucre',
          'Prix de l\'huile',
        ],
        type: 'general',
      };
    }

    if (queryLower.includes('conseil') || queryLower.includes('advice') || queryLower.includes('likamwis')) {
      return {
        answer: "Je peux vous donner des conseils sur vos dépenses ! Par exemple, je peux vous montrer où économiser ou comparer les prix entre magasins.",
        answerLingala: 'Nakoki kopesa yo likebisi na mbongo na yo! Ndakisa, nakoki komonisa yo wapi olingi kobikisa mbongo to kokompara ntalo na magazini.',
        suggestions: [
          'Où économiser ?',
          'Comparer les prix',
          'Mes habitudes de dépenses',
        ],
        type: 'general',
      };
    }

    // Default helpful response
    return {
      answer: "Je suis votre assistant financier personnel ! Je peux vous aider avec vos dépenses, les prix des articles, ou des conseils d'économie. Essayez une de ces questions :",
      answerLingala: 'Nazali assistant financier na yo! Nakoki kosunga yo na mbongo na yo, ntalo ya biloko, to likebisi ya kobikisa mbongo. Meka kotuna ndakisa:',
      suggestions: [
        "Combien j'ai dépensé ce mois ?",
        'Prix du riz',
        'Où trouver les meilleurs prix ?',
      ],
      type: 'general',
    };
  }
    // Get receipts from a broader range and filter in memory to avoid index requirements
    const broaderStart = new Date(period.start);
    broaderStart.setMonth(broaderStart.getMonth() - 1); // Get one month earlier

    const snapshot = await firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .where('scannedAt', '>=', broaderStart)
      .orderBy('scannedAt', 'desc')
      .get();

    let totalSpent = 0;
    let receiptCount = 0;
    const byStore: {[key: string]: number} = {};

    // Filter results in memory
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const scannedAt = safeToDate(data.scannedAt);

      if (scannedAt >= period.start && scannedAt <= period.end) {
        totalSpent += data.total || 0;
        receiptCount++;

        const store = data.storeName || 'Inconnu';
        byStore[store] = (byStore[store] || 0) + (data.total || 0);
      }
    });

    const topStore = Object.entries(byStore).sort((a, b) => b[1] - a[1])[0];

    const avgPerReceipt = receiptCount > 0 ? totalSpent / receiptCount : 0;

    return {
      answer: `${
        period.label.charAt(0).toUpperCase() + period.label.slice(1)
      }, vous avez dépensé $${totalSpent.toFixed(
        2,
      )} sur ${receiptCount} factures. La moyenne est de $${avgPerReceipt.toFixed(
        2,
      )} par achat.${
        topStore
          ? ` Vous avez le plus dépensé chez ${
              topStore[0]
            } ($${topStore[1].toFixed(2)}).`
          : ''
      }`,
      answerLingala: `Na ${period.label}, olekisi $${totalSpent.toFixed(
        2,
      )} na factures ${receiptCount}. Moyenne ezali $${avgPerReceipt.toFixed(
        2,
      )}.${
        topStore
          ? ` Olekisi mingi na ${topStore[0]} ($${topStore[1].toFixed(2)}).`
          : ''
      }`,
      data: {
        totalSpent,
        receiptCount,
        avgPerReceipt,
        byStore,
        period: period.label,
      },
      chartData: {
        type: 'bar',
        labels: Object.keys(byStore).slice(0, 5),
        datasets: [
          {
            label: 'Dépenses par magasin',
            data: Object.values(byStore).slice(0, 5),
          },
        ],
      },
      suggestions: [
        'Mes dépenses en nourriture',
        'Comparer avec le mois dernier',
        'Quel magasin est le moins cher ?',
      ],
      type: 'spending_summary',
    };
  }

  /**
   * Get category breakdown
   */
  private async getCategoryBreakdown(
    userId: string,
    period: {start: Date; end: Date; label: string},
    filterCategory: string | null,
  ): Promise<QueryResult> {
    // Get receipts from a broader range and filter in memory
    const broaderStart = new Date(period.start);
    broaderStart.setMonth(broaderStart.getMonth() - 1);

    const snapshot = await firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .where('scannedAt', '>=', broaderStart)
      .orderBy('scannedAt', 'desc')
      .get();

    const byCategory: {[key: string]: number} = {};
    let totalSpent = 0;
    let filteredTotal = 0;

    // Filter results in memory
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const scannedAt = safeToDate(data.scannedAt);

      if (scannedAt >= period.start && scannedAt <= period.end) {
        const items = data.items || [];

        items.forEach((item: any) => {
          const cat = item.category || 'Autres';
          const amount = (item.unitPrice || 0) * (item.quantity || 1);
          byCategory[cat] = (byCategory[cat] || 0) + amount;
          totalSpent += amount;

          if (filterCategory && cat === filterCategory) {
            filteredTotal += amount;
          }
        });
      }
    });

    const sortedCategories = Object.entries(byCategory).sort(
      (a, b) => b[1] - a[1],
    );

    if (filterCategory) {
      const percentage =
        totalSpent > 0 ? ((filteredTotal / totalSpent) * 100).toFixed(1) : 0;
      return {
        answer: `${period.label}, vous avez dépensé $${filteredTotal.toFixed(
          2,
        )} en ${filterCategory}, soit ${percentage}% de vos dépenses totales.`,
        answerLingala: `Na ${period.label}, olekisi $${filteredTotal.toFixed(
          2,
        )} na ${filterCategory}, ezali ${percentage}% ya mbongo nyonso.`,
        data: {
          category: filterCategory,
          amount: filteredTotal,
          percentage,
          total: totalSpent,
        },
        suggestions: [
          'Voir toutes les catégories',
          'Mes dépenses totales',
          `Évolution de ${filterCategory}`,
        ],
        type: 'category_breakdown',
      };
    }

    const topCategories = sortedCategories.slice(0, 5);
    const categoryList = topCategories
      .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
      .join(', ');

    return {
      answer: `${period.label}, voici vos dépenses par catégorie : ${categoryList}.`,
      answerLingala: `Na ${period.label}, mbongo na yo : ${categoryList}.`,
      data: {byCategory, totalSpent},
      chartData: {
        type: 'pie',
        labels: topCategories.map(([cat]) => cat),
        datasets: [
          {
            label: 'Dépenses par catégorie',
            data: topCategories.map(([, amount]) => amount),
            colors: ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'],
          },
        ],
      },
      suggestions: sortedCategories
        .slice(0, 3)
        .map(([cat]) => `Détails ${cat}`),
      type: 'category_breakdown',
    };
  }

  /**
   * Get store comparison
   */
  private async getStoreComparison(
    userId: string,
    period: {start: Date; end: Date; label: string},
  ): Promise<QueryResult> {
    // Get receipts from a broader range and filter in memory
    const broaderStart = new Date(period.start);
    broaderStart.setMonth(broaderStart.getMonth() - 1);

    const snapshot = await firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .where('scannedAt', '>=', broaderStart)
      .orderBy('scannedAt', 'desc')
      .get();

    const byStore: {[key: string]: {total: number; count: number}} = {};

    // Filter results in memory
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const scannedAt = safeToDate(data.scannedAt);

      if (scannedAt >= period.start && scannedAt <= period.end) {
        const store = data.storeName || 'Inconnu';

        if (!byStore[store]) {
          byStore[store] = {total: 0, count: 0};
        }

        byStore[store].total += data.total || 0;
        byStore[store].count++;
      }
    });

    const sortedStores = Object.entries(byStore)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        avgPerVisit: data.total / data.count,
      }))
      .sort((a, b) => b.total - a.total);

    const cheapest =
      sortedStores.length > 0
        ? sortedStores.reduce((a, b) => (a.avgPerVisit < b.avgPerVisit ? a : b))
        : null;

    const mostVisited = sortedStores[0];

    return {
      answer: `${period.label}, vous avez visité ${
        sortedStores.length
      } magasins. ${
        mostVisited
          ? `Le plus fréquenté est ${mostVisited.name} (${
              mostVisited.count
            } visites, $${mostVisited.total.toFixed(2)} au total).`
          : ''
      } ${
        cheapest
          ? `${
              cheapest.name
            } a la moyenne la plus basse ($${cheapest.avgPerVisit.toFixed(
              2,
            )}/visite).`
          : ''
      }`,
      answerLingala: `Na ${period.label}, okei na magazini ${
        sortedStores.length
      }. ${
        mostVisited
          ? `Magazini oyo okendaka mingi ezali ${mostVisited.name}.`
          : ''
      } ${
        cheapest
          ? `${
              cheapest.name
            } ezali na ntalo ya nse ($${cheapest.avgPerVisit.toFixed(2)}).`
          : ''
      }`,
      data: {stores: sortedStores, cheapest},
      chartData: {
        type: 'bar',
        labels: sortedStores.slice(0, 5).map(s => s.name),
        datasets: [
          {
            label: 'Total par magasin',
            data: sortedStores.slice(0, 5).map(s => s.total),
          },
        ],
      },
      suggestions: [
        `Détails ${mostVisited?.name || ''}`,
        'Comparer les prix',
        'Mes dépenses totales',
      ],
      type: 'store_comparison',
    };
  }

  /**
   * Search for item prices
   */
  private async searchItemPrices(
    userId: string,
    itemName: string,
  ): Promise<QueryResult> {
    if (!itemName) {
      return {
        answer:
          'Quel article recherchez-vous ? Dites par exemple "prix du riz" ou "combien coûte le sucre".',
        answerLingala:
          'Eloko nini ozali koluka? Loba ndakisa "ntalo ya loso" to "sukali ezali ntalo boni".',
        suggestions: ['Prix du riz', 'Prix du sucre', "Prix de l'huile"],
        type: 'item_search',
      };
    }

    const normalizedName = itemName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Search in prices collection
    const pricesSnapshot = await firestore()
      .collection(`artifacts/${APP_ID}/prices`)
      .where('productNameNormalized', '>=', normalizedName)
      .where('productNameNormalized', '<=', normalizedName + '\uf8ff')
      .limit(20)
      .get();

    if (pricesSnapshot.empty) {
      return {
        answer: `Je n'ai pas trouvé de prix pour "${itemName}". Essayez un autre terme ou scannez une facture avec cet article.`,
        answerLingala: `Nazwi ntalo ya "${itemName}" te. Meka liloba mosusu to scanner facture na eloko yango.`,
        suggestions: ['Prix du riz', 'Mes dépenses', 'Scanner une facture'],
        type: 'item_search',
      };
    }

    const prices: {store: string; price: number; date: Date}[] = [];
    pricesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      prices.push({
        store: data.storeName,
        price: data.price,
        date: safeToDate(data.recordedAt) || new Date(),
      });
    });

    // Group by store, get latest price
    const storeprices: {[store: string]: number} = {};
    prices.forEach(p => {
      if (!storeprices[p.store] || p.price < storeprices[p.store]) {
        storeprices[p.store] = p.price;
      }
    });

    const sortedPrices = Object.entries(storeprices).sort(
      (a, b) => a[1] - b[1],
    );

    const bestPrice = sortedPrices[0];
    const avgPrice =
      Object.values(storeprices).reduce((a, b) => a + b, 0) /
      Object.keys(storeprices).length;

    const priceList = sortedPrices
      .slice(0, 3)
      .map(([store, price]) => `${store}: $${price.toFixed(2)}`)
      .join(', ');

    return {
      answer: `"${itemName}" - Meilleur prix : ${
        bestPrice[0]
      } à $${bestPrice[1].toFixed(2)}. Prix moyen : $${avgPrice.toFixed(
        2,
      )}. Autres prix : ${priceList}.`,
      answerLingala: `"${itemName}" - Ntalo ya malamu: ${
        bestPrice[0]
      } na $${bestPrice[1].toFixed(2)}. Ntalo moyenne: $${avgPrice.toFixed(
        2,
      )}.`,
      data: {
        item: itemName,
        bestStore: bestPrice[0],
        bestPrice: bestPrice[1],
        avgPrice,
        allPrices: storeprices,
      },
      chartData: {
        type: 'bar',
        labels: sortedPrices.map(([store]) => store),
        datasets: [
          {
            label: `Prix de ${itemName}`,
            data: sortedPrices.map(([, price]) => price),
          },
        ],
      },
      suggestions: [
        `Créer alerte pour ${itemName}`,
        'Chercher un autre article',
        'Mes dépenses totales',
      ],
      type: 'item_search',
    };
  }

  /**
   * Process with AI (Cloud Function) - Enhanced error handling
   */
  private async processWithAI(
    userId: string,
    query: string,
  ): Promise<QueryResult> {
    try {
      const processNLQuery = functions().httpsCallable('processNLQuery');
      const result = await processNLQuery({
        query,
        conversationHistory: this.conversationHistory.slice(-3), // Reduced to 3 for better context
      });

      return result.data as QueryResult;
    } catch (error) {
      console.error('[NLQuery] AI processing error:', error);

      // Enhanced fallback: Try to provide a contextual response even when AI fails
      try {
        const timePeriod = this.extractTimePeriod(query);
        const basicData = await this.getBasicSpendingData(userId, timePeriod);
        const queryType = this.detectQueryType(query);
        return this.generateIntelligentResponse(query, queryType, timePeriod, basicData);
      } catch (fallbackError) {
        console.error('[NLQuery] Fallback processing also failed:', fallbackError);

        // Final fallback to basic response
        return {
          answer: "Désolé, je rencontre des difficultés techniques. Pouvez-vous réessayer votre question ou me demander quelque chose de plus simple comme 'combien j'ai dépensé ce mois' ?",
          answerLingala: 'Limbisa, nazali na problème technique. Meka kotuna lisusu to kotuna eloko ya pɛtɛɛ ndenge "mbongo boni nalekisi sanza oyo".',
          suggestions: [
            "Combien j'ai dépensé ce mois ?",
            'Mes dépenses en nourriture',
            'Prix du riz',
          ],
          type: 'general',
        };
      }
    }
  }

  /**
   * Add message to conversation history
   */
  private addMessage(
    role: 'user' | 'assistant',
    content: string,
    contentLingala?: string,
  ): void {
    this.conversationHistory.push({
      id: `msg_${Date.now()}`,
      role,
      content,
      contentLingala,
      timestamp: new Date(),
    });

    // Keep only last 10 messages
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get suggested queries
   */
  getSuggestedQueries(): {fr: string; lingala: string}[] {
    return [
      {
        fr: "Combien j'ai dépensé ce mois ?",
        lingala: 'Mbongo boni nalekisi sanza oyo?',
      },
      {fr: 'Mes dépenses en nourriture', lingala: 'Mbongo ya bilei'},
      {
        fr: 'Quel magasin est le moins cher ?',
        lingala: 'Magazini nini ezali na ntalo ya nse?',
      },
      {fr: 'Prix du riz', lingala: 'Ntalo ya loso'},
      {fr: 'Comparer mes dépenses', lingala: 'Kokompara mbongo na ngai'},
    ];
  }
}

export const naturalLanguageService = new NaturalLanguageService();
