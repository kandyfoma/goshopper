/**
 * Natural Language Query Cloud Function
 * Processes conversational queries about spending using Gemini AI
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {config, collections} from '../config';

const db = admin.firestore();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

interface QueryResult {
  answer: string;
  answerLingala?: string;
  data?: any;
  suggestions?: string[];
  type: string;
}

/**
 * Process natural language query with AI
 */
export const processNLQuery = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const {query, conversationHistory} = data;

    if (!query) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Query is required',
      );
    }

    const userId = context.auth.uid;

    try {
      // Check if API key is configured
      if (!config.gemini.apiKey) {
        console.error('GEMINI_API_KEY not configured in Firebase Functions');
        throw new functions.https.HttpsError(
          'failed-precondition',
          'AI service not configured. Please contact support.',
        );
      }

      // Gather user's spending context
      const spendingContext = await gatherSpendingContext(userId);

      // Build prompt for Gemini
      const prompt = buildPrompt(
        query,
        spendingContext,
        conversationHistory || [],
      );

      // Call Gemini
      const model = genAI.getGenerativeModel({model: config.gemini.model});
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse structured response
      const parsedResult = parseAIResponse(text);

      return {
        success: true,
        ...parsedResult,
      };
    } catch (error) {
      console.error('NL Query error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to process query',
      );
    }
  });

/**
 * Gather spending context for the AI
 */
async function gatherSpendingContext(userId: string): Promise<string> {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Get receipts from the last 2 months to avoid complex queries
  let recentReceipts;
  try {
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // Try the filtered query first
    try {
      recentReceipts = await db
        .collection(collections.receipts(userId))
        .where('scannedAt', '>=', twoMonthsAgo)
        .orderBy('scannedAt', 'desc')
        .get();
    } catch (filterError) {
      console.warn('Filtered query failed, trying simple query:', filterError);
      // Fallback to simple query without filtering
      recentReceipts = await db
        .collection(collections.receipts(userId))
        .orderBy('scannedAt', 'desc')
        .limit(50) // Limit to avoid too many results
        .get();
    }
  } catch (error) {
    console.warn('Failed to query recent receipts:', error);
    recentReceipts = {docs: []};
  }

  // Filter receipts by date ranges in memory
  const thisMonthReceipts = recentReceipts.docs.filter(doc => {
    const scannedAt = doc.data().scannedAt?.toDate();
    return scannedAt && scannedAt >= thisMonth;
  });

  // Calculate statistics
  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  const categoryTotals: {[key: string]: number} = {};
  const storeTotals: {[key: string]: number} = {};
  const items: {name: string; price: number; store: string}[] = [];

  // Collect items from ALL recent receipts (not just this month)
  recentReceipts.docs.forEach(doc => {
    const data = doc.data();
    
    // Add to monthly totals based on date
    const scannedAt = data.scannedAt?.toDate();
    if (scannedAt && scannedAt >= thisMonth) {
      thisMonthTotal += data.total || 0;
    } else if (scannedAt && scannedAt >= lastMonth && scannedAt < thisMonth) {
      lastMonthTotal += data.total || 0;
    }

    // Add to store totals
    storeTotals[data.storeName] = (storeTotals[data.storeName] || 0) + (data.total || 0);

    // Collect ALL items from recent receipts
    (data.items || []).forEach((item: any) => {
      const cat = item.category || 'Autres';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.unitPrice * item.quantity);
      items.push({
        name: item.name,
        price: item.unitPrice,
        store: data.storeName,
      });
    });
  });

  console.log(`Found ${recentReceipts.docs.length} receipts with ${items.length} total items`);

  // Build context string
  const context = `
CONTEXTE DES DÉPENSES DE L'UTILISATEUR:

Période: ${thisMonth.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })}

RÉSUMÉ CE MOIS:
- Total dépensé: $${thisMonthTotal.toFixed(2)}
- Nombre de factures: ${thisMonthReceipts.length}
- Moyenne par facture: $${(
    thisMonthTotal / Math.max(thisMonthReceipts.length, 1)
  ).toFixed(2)}

COMPARAISON:
- Mois dernier: $${lastMonthTotal.toFixed(2)}
- Différence: ${thisMonthTotal >= lastMonthTotal ? '+' : ''}$${(
    thisMonthTotal - lastMonthTotal
  ).toFixed(2)}

DÉPENSES PAR CATÉGORIE:
${Object.entries(categoryTotals)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, total]) => `- ${cat}: $${total.toFixed(2)}`)
  .join('\n')}

DÉPENSES PAR MAGASIN:
${Object.entries(storeTotals)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([store, total]) => `- ${store}: $${total.toFixed(2)}`)
  .join('\n')}

ARTICLES RÉCENTS (échantillon):
${items
  .slice(0, 10)
  .map(item => `- ${item.name}: $${item.price.toFixed(2)} (${item.store})`)
  .join('\n')}
  `.trim();

  return context;
}

/**
 * Build the prompt for Gemini
 */
function buildPrompt(
  query: string,
  spendingContext: string,
  history: Array<{role: string; content: string}>,
): string {
  const historyText =
    history.length > 0
      ? `\nHISTORIQUE DE CONVERSATION:\n${history
          .map(m => `${m.role}: ${m.content}`)
          .join('\n')}\n`
      : '';

  return `
Tu es un assistant financier personnel pour une application de suivi des dépenses utilisée principalement par des femmes au Congo (RDC). Tu dois répondre de manière amicale, claire et utile.

${spendingContext}

${historyText}

QUESTION DE L'UTILISATEUR: ${query}

INSTRUCTIONS:
1. Réponds en français de manière claire et concise
2. Utilise les données du contexte pour fournir des réponses précises
3. Si pertinent, suggère des questions de suivi
4. Si la question est hors sujet (pas liée aux finances), réponds poliment que tu ne peux aider que pour les questions financières

FORMAT DE RÉPONSE (JSON):
{
  "answer": "Ta réponse en français",
  "answerLingala": "Ta réponse en Lingala (optionnel, phrases simples)",
  "type": "spending_summary|category_breakdown|store_comparison|item_search|general",
  "suggestions": ["Question suggérée 1", "Question suggérée 2"],
  "data": {
    // données structurées si pertinent
  }
}

Réponds UNIQUEMENT avec le JSON, pas de texte avant ou après.
  `.trim();
}

/**
 * Parse the AI response
 */
function parseAIResponse(text: string): QueryResult {
  try {
    // Remove markdown code blocks if present
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.slice(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.slice(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.slice(0, -3);
    }
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);

    return {
      answer: parsed.answer || "Désolé, je n'ai pas pu traiter votre demande.",
      answerLingala: parsed.answerLingala,
      type: parsed.type || 'general',
      suggestions: parsed.suggestions || [],
      data: parsed.data,
    };
  } catch (error) {
    console.error('Parse AI response error:', error);

    // Return the raw text as answer if parsing fails
    return {
      answer: text || "Désolé, une erreur s'est produite.",
      type: 'general',
      suggestions: [],
    };
  }
}

/**
 * Get spending suggestions based on patterns
 */
export const getSpendingSuggestions = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;

    try {
      // Gather context
      const context = await gatherSpendingContext(userId);

      // Generate suggestions with AI
      const model = genAI.getGenerativeModel({model: config.gemini.model});

      const prompt = `
Basé sur ce contexte de dépenses, génère 3 suggestions personnalisées pour économiser de l'argent.

${context}

FORMAT (JSON array):
[
  {
    "title": "Titre court",
    "description": "Description de la suggestion",
    "potentialSavings": 10.00
  }
]

Réponds UNIQUEMENT avec le JSON.
      `.trim();

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // Clean markdown
      if (text.startsWith('```')) {
        text = text
          .replace(/```json?\n?/g, '')
          .replace(/```/g, '')
          .trim();
      }

      const suggestions = JSON.parse(text);

      return {
        success: true,
        suggestions,
      };
    } catch (error) {
      console.error('Get suggestions error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get suggestions',
      );
    }
  });
