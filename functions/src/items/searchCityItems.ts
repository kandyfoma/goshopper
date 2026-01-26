/**
 * City Items Search Service
 * Provides server-side search for city items with relevance ranking
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

/**
 * Calculate Levenshtein distance for fuzzy matching
 * Returns similarity score between 0 and 1 (1 = identical)
 */
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const matrix: number[][] = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator,
      );
    }
  }

  const distance = matrix[str2.length][str1.length];
  const maxLen = Math.max(str1.length, str2.length);
  return 1 - distance / maxLen;
}

/**
 * Normalize search query for consistent matching
 */
function normalizeSearchQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Calculate relevance score for a search result
 * Higher score = more relevant
 */
function calculateRelevanceScore(
  item: any,
  normalizedQuery: string,
  originalQuery: string,
): number {
  let score = 0;
  let hasTextMatch = false;

  const itemName = (item.nameNormalized || item.name || '').toLowerCase();
  const queryLower = normalizedQuery.toLowerCase();

  // 1. Exact match (highest priority)
  if (itemName === queryLower) {
    score += 100;
    hasTextMatch = true;
  }

  // 2. Starts with query
  if (itemName.startsWith(queryLower)) {
    score += 50;
    hasTextMatch = true;
  }

  // 3. Contains query
  if (itemName.includes(queryLower)) {
    score += 25;
    hasTextMatch = true;
  }

  // 4. Keyword match (multi-language support)
  if (
    item.searchKeywords &&
    Array.isArray(item.searchKeywords) &&
    item.searchKeywords.length > 0
  ) {
    const keywordMatch = item.searchKeywords.some((kw: string) => {
      const kwLower = kw.toLowerCase();
      return (
        kwLower.includes(queryLower) ||
        queryLower.includes(kwLower) ||
        kwLower === queryLower
      );
    });
    if (keywordMatch) {
      score += 30;
      hasTextMatch = true;
    }
  }

  // 5. Category match
  if (item.category) {
    const categoryLower = item.category.toLowerCase();
    if (categoryLower.includes(queryLower)) {
      score += 15;
      hasTextMatch = true;
    }
  }

  // 6. Fuzzy match (typo tolerance) - only if query is long enough
  if (queryLower.length >= 4 && itemName.length >= 4) {
    const fuzzyScore = calculateLevenshteinSimilarity(itemName, queryLower);
    if (fuzzyScore > 0.7) {
      // 70% similarity threshold
      score += fuzzyScore * 20;
      hasTextMatch = true;
    }
  }

  // 7. Word boundary matches (whole word matches score higher)
  const queryWords = queryLower.split(/\s+/);
  const itemWords = itemName.split(/\s+/);
  const wordMatches = queryWords.filter((qw: string) =>
    itemWords.some((iw: string) => iw.includes(qw) || qw.includes(iw)),
  ).length;
  if (wordMatches > 0) {
    score += wordMatches * 10;
    hasTextMatch = true;
  }

  // If no text match, return 0 (don't show unrelated items)
  if (!hasTextMatch) {
    return 0;
  }

  // Only apply popularity/recency boosts if there's an actual text match
  // 8. Popularity boost (but not dominant - logarithmic scale)
  const totalPurchases = item.totalPurchases || item.prices?.length || 0;
  const popularityBoost = Math.log(1 + totalPurchases) * 2;
  score += popularityBoost;

  // 9. Recency boost (items purchased recently)
  if (item.lastPurchaseDate) {
    const lastPurchaseMillis =
      typeof item.lastPurchaseDate.toMillis === 'function'
        ? item.lastPurchaseDate.toMillis()
        : new Date(item.lastPurchaseDate).getTime();
    const daysSinceLastPurchase =
      (Date.now() - lastPurchaseMillis) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 5 - daysSinceLastPurchase / 10);
    score += recencyBoost;
  }

  // 10. User count boost (more users = more trusted price data)
  const userCount = item.userCount || 0;
  if (userCount > 1) {
    score += Math.log(userCount) * 1.5;
  }

  return score;
}

/**
 * Track search query for analytics
 */
async function trackSearchQuery(data: {
  userId: string;
  city: string;
  query: string;
  resultCount: number;
  timestamp: any;
}): Promise<void> {
  try {
    await db.collection('searchAnalytics').add(data);
  } catch (error) {
    console.error('Error tracking search query:', error);
    // Don't throw - analytics failure shouldn't break search
  }
}

/**
 * Search city items with relevance ranking
 * This provides backend search instead of client-side filtering
 */
export const searchCityItems = functions
  .region('europe-west1')
  .runWith({timeoutSeconds: 30, memory: '512MB'})
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const userId = context.auth.uid;
    const {city, query, page = 1, pageSize = 20} = data;

    // Validate inputs
    if (!city || typeof city !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'City parameter is required and must be a string',
      );
    }

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return {
        success: true,
        items: [],
        total: 0,
        page: 1,
        hasMore: false,
        message: 'Query must be at least 2 characters',
      };
    }

    try {
      const startTime = Date.now();
      console.log(
        `🔍 Searching city items - City: ${city}, Query: "${query}", User: ${userId}`,
      );

      const normalizedQuery = normalizeSearchQuery(query);
      const cityItemsRef = db.collection(
        `artifacts/${config.app.id}/cityItems/${city}/items`,
      );

      // Fetch candidate items (limit to reasonable number for performance)
      // In production, this should be replaced with Algolia/ElasticSearch
      const snapshot = await cityItemsRef.limit(1000).get();

      if (snapshot.empty) {
        console.log(`No items found in city ${city}`);
        return {
          success: true,
          items: [],
          total: 0,
          page: 1,
          hasMore: false,
          message: `No items available for ${city}`,
        };
      }

      console.log(`Filtering ${snapshot.size} candidate items...`);

      // Score and rank results
      const scoredResults = snapshot.docs
        .map(doc => {
          const itemData = doc.data();
          const score = calculateRelevanceScore(
            itemData,
            normalizedQuery,
            query,
          );
          return {
            ...itemData,
            id: doc.id,
            relevanceScore: score,
          };
        })
        .filter(item => item.relevanceScore > 0) // Only return relevant results
        .sort((a, b) => b.relevanceScore - a.relevanceScore); // Sort by relevance

      console.log(
        `Found ${scoredResults.length} relevant results (filtered from ${snapshot.size} items)`,
      );

      // Pagination
      const startIdx = (page - 1) * pageSize;
      const paginatedResults = scoredResults.slice(
        startIdx,
        startIdx + pageSize,
      );

      // Track search analytics
      await trackSearchQuery({
        userId,
        city,
        query: query.trim(),
        resultCount: scoredResults.length,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      const searchTime = Date.now() - startTime;
      console.log(
        `✅ Search completed in ${searchTime}ms - Returning ${paginatedResults.length} of ${scoredResults.length} results`,
      );

      if (paginatedResults.length > 0) {
        console.log(
          `   Top 3 results: ${paginatedResults
            .slice(0, 3)
            .map(
              (item: any) =>
                `${item.name} (score: ${item.relevanceScore.toFixed(1)})`,
            )
            .join(', ')}`,
        );
      }

      return {
        success: true,
        items: paginatedResults,
        total: scoredResults.length,
        page,
        pageSize,
        hasMore: startIdx + pageSize < scoredResults.length,
        searchTimeMs: searchTime,
      };
    } catch (error: any) {
      console.error('Error in searchCityItems:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Search failed: ${error.message}`,
      );
    }
  });
