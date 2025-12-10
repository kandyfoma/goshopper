"use strict";
/**
 * Natural Language Query Cloud Function
 * Processes conversational queries about spending using Gemini AI
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpendingSuggestions = exports.processNLQuery = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("../config");
const db = admin.firestore();
// Initialize Gemini
const genAI = new generative_ai_1.GoogleGenerativeAI(config_1.config.gemini.apiKey);
/**
 * Process natural language query with AI
 */
exports.processNLQuery = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const { query, conversationHistory } = data;
    if (!query) {
        throw new functions.https.HttpsError('invalid-argument', 'Query is required');
    }
    const userId = context.auth.uid;
    try {
        // Gather user's spending context
        const spendingContext = await gatherSpendingContext(userId);
        // Build prompt for Gemini
        const prompt = buildPrompt(query, spendingContext, conversationHistory || []);
        // Call Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // Parse structured response
        const parsedResult = parseAIResponse(text);
        return {
            success: true,
            ...parsedResult,
        };
    }
    catch (error) {
        console.error('NL Query error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to process query');
    }
});
/**
 * Gather spending context for the AI
 */
async function gatherSpendingContext(userId) {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Get this month's receipts
    const thisMonthReceipts = await db
        .collection(config_1.collections.receipts(userId))
        .where('date', '>=', thisMonth)
        .get();
    // Get last month's receipts
    const lastMonthReceipts = await db
        .collection(config_1.collections.receipts(userId))
        .where('date', '>=', lastMonth)
        .where('date', '<', thisMonth)
        .get();
    // Calculate statistics
    let thisMonthTotal = 0;
    let lastMonthTotal = 0;
    const categoryTotals = {};
    const storeTotals = {};
    const items = [];
    thisMonthReceipts.docs.forEach(doc => {
        const data = doc.data();
        thisMonthTotal += data.total || 0;
        storeTotals[data.storeName] = (storeTotals[data.storeName] || 0) + data.total;
        (data.items || []).forEach((item) => {
            const cat = item.category || 'Autres';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.unitPrice * item.quantity);
            items.push({
                name: item.name,
                price: item.unitPrice,
                store: data.storeName,
            });
        });
    });
    lastMonthReceipts.docs.forEach(doc => {
        lastMonthTotal += doc.data().total || 0;
    });
    // Build context string
    const context = `
CONTEXTE DES DÉPENSES DE L'UTILISATEUR:

Période: ${thisMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}

RÉSUMÉ CE MOIS:
- Total dépensé: $${thisMonthTotal.toFixed(2)}
- Nombre de factures: ${thisMonthReceipts.size}
- Moyenne par facture: $${(thisMonthTotal / Math.max(thisMonthReceipts.size, 1)).toFixed(2)}

COMPARAISON:
- Mois dernier: $${lastMonthTotal.toFixed(2)}
- Différence: ${thisMonthTotal >= lastMonthTotal ? '+' : ''}$${(thisMonthTotal - lastMonthTotal).toFixed(2)}

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
${items.slice(0, 10).map(item => `- ${item.name}: $${item.price.toFixed(2)} (${item.store})`).join('\n')}
  `.trim();
    return context;
}
/**
 * Build the prompt for Gemini
 */
function buildPrompt(query, spendingContext, history) {
    const historyText = history.length > 0
        ? `\nHISTORIQUE DE CONVERSATION:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}\n`
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
function parseAIResponse(text) {
    try {
        // Remove markdown code blocks if present
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.slice(7);
        }
        else if (cleanText.startsWith('```')) {
            cleanText = cleanText.slice(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.slice(0, -3);
        }
        cleanText = cleanText.trim();
        const parsed = JSON.parse(cleanText);
        return {
            answer: parsed.answer || 'Désolé, je n\'ai pas pu traiter votre demande.',
            answerLingala: parsed.answerLingala,
            type: parsed.type || 'general',
            suggestions: parsed.suggestions || [],
            data: parsed.data,
        };
    }
    catch (error) {
        console.error('Parse AI response error:', error);
        // Return the raw text as answer if parsing fails
        return {
            answer: text || 'Désolé, une erreur s\'est produite.',
            type: 'general',
            suggestions: [],
        };
    }
}
/**
 * Get spending suggestions based on patterns
 */
exports.getSpendingSuggestions = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    try {
        // Gather context
        const context = await gatherSpendingContext(userId);
        // Generate suggestions with AI
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
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
            text = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        const suggestions = JSON.parse(text);
        return {
            success: true,
            suggestions,
        };
    }
    catch (error) {
        console.error('Get suggestions error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get suggestions');
    }
});
//# sourceMappingURL=naturalLanguage.js.map