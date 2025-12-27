// Budget Service - Hybrid Monthly Budget System
// Manages monthly budgets with lazy creation and default template
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from './config';
import {MonthlyBudget} from '@/shared/types/user.types';

/**
 * Get current month key in YYYY-MM format
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get month key for a specific date
 */
export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parse month key to readable format (e.g., "Décembre 2025")
 */
export function formatMonthKey(monthKey: string, locale: string = 'fr-FR'): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString(locale, {month: 'long', year: 'numeric'});
}

/**
 * Get current month budget for a user (with lazy creation)
 * If no budget exists for current month:
 * 1. Check if user has defaultMonthlyBudget
 * 2. If yes, create new month budget with that amount
 * 3. If no, fall back to legacy monthlyBudget or 0
 */
export async function getCurrentMonthBudget(
  userId: string,
  defaultBudget?: number,
  currency: 'USD' | 'CDF' = 'USD',
): Promise<{amount: number; currency: 'USD' | 'CDF'; isCustom: boolean}> {
  try {
    const monthKey = getCurrentMonthKey();
    const budgetRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('budgets')
      .doc(monthKey);

    const budgetDoc = await budgetRef.get();

    if (budgetDoc.exists) {
      const data = budgetDoc.data() as MonthlyBudget;
      return {
        amount: data.amount,
        currency: data.currency,
        isCustom: data.isCustom,
      };
    }

    // Budget doesn't exist - lazy create from default
    if (defaultBudget && defaultBudget > 0) {
      const newBudget: MonthlyBudget = {
        userId,
        month: monthKey,
        amount: defaultBudget,
        currency,
        isCustom: false, // Auto-copied from default
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await budgetRef.set(newBudget);

      return {
        amount: defaultBudget,
        currency,
        isCustom: false,
      };
    }

    // No default budget - return 0
    return {
      amount: 0,
      currency,
      isCustom: false,
    };
  } catch (error) {
    // Silently return fallback - permission errors happen during app init before auth is ready
    return {
      amount: 0,
      currency,
      isCustom: false,
    };
  }
}

/**
 * Update current month budget (marks as custom)
 */
export async function updateCurrentMonthBudget(
  userId: string,
  amount: number,
  currency: 'USD' | 'CDF' = 'USD',
): Promise<void> {
  try {
    const monthKey = getCurrentMonthKey();
    const budgetRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('budgets')
      .doc(monthKey);

    const budget: MonthlyBudget = {
      userId,
      month: monthKey,
      amount,
      currency,
      isCustom: true, // User manually updated
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await budgetRef.set(budget, {merge: true});
  } catch (error) {
    console.error('Error updating current month budget:', error);
    throw error;
  }
}

/**
 * Get budget for a specific month
 */
export async function getMonthBudget(
  userId: string,
  monthKey: string,
): Promise<MonthlyBudget | null> {
  try {
    const budgetDoc = await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('budgets')
      .doc(monthKey)
      .get();

    if (budgetDoc.exists) {
      return budgetDoc.data() as MonthlyBudget;
    }

    return null;
  } catch (error) {
    console.error('Error getting month budget:', error);
    return null;
  }
}

/**
 * Get recent budget history (last N months)
 */
export async function getBudgetHistory(
  userId: string,
  months: number = 3,
): Promise<MonthlyBudget[]> {
  try {
    const budgets = await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('budgets')
      .orderBy('month', 'desc')
      .limit(months)
      .get();

    return budgets.docs.map(doc => doc.data() as MonthlyBudget);
  } catch (error) {
    console.error('Error getting budget history:', error);
    return [];
  }
}

/**
 * Subscribe to current month budget changes
 */
export function subscribeToCurrentMonthBudget(
  userId: string,
  callback: (budget: {amount: number; currency: 'USD' | 'CDF'; isCustom: boolean}) => void,
): () => void {
  const monthKey = getCurrentMonthKey();
  const budgetRef = firestore()
    .collection('artifacts')
    .doc(APP_ID)
    .collection('users')
    .doc(userId)
    .collection('budgets')
    .doc(monthKey);

  return budgetRef.onSnapshot(
    snapshot => {
      if (snapshot.exists) {
        const data = snapshot.data() as MonthlyBudget;
        callback({
          amount: data.amount,
          currency: data.currency,
          isCustom: data.isCustom,
        });
      }
    },
    error => {
      console.error('Error subscribing to budget:', error);
    },
  );
}

/**
 * Delete a specific month budget
 */
export async function deleteMonthBudget(
  userId: string,
  monthKey: string,
): Promise<void> {
  try {
    await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('budgets')
      .doc(monthKey)
      .delete();
  } catch (error) {
    console.error('Error deleting month budget:', error);
    throw error;
  }
}
