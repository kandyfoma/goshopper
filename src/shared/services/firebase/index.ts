// Firebase services barrel export
export {
  initializeFirebase,
  firebaseAuth,
  firebaseFirestore,
  firebaseStorage,
  APP_ID,
  COLLECTIONS,
} from './config';
export {authService} from './auth';
export {subscriptionService} from './subscription';
export {receiptStorageService} from './receiptStorage';
export type {Shop} from './receiptStorage';

// Phase 1.1 Services
export {priceAlertsService} from './priceAlerts';
export type {PriceAlert, PriceAlertInput} from './priceAlerts';

export {naturalLanguageService} from './naturalLanguage';
export type {
  QueryResult,
  ConversationMessage,
  ChartData,
  QueryResultType,
} from './naturalLanguage';

export {offlineQueueService} from './offlineQueue';
export type {QueuedReceipt, QueuedImage} from './offlineQueue';

export {pushNotificationService} from './pushNotifications';
export type {
  PushNotification,
  NotificationPreferences,
} from './pushNotifications';

export {savingsTrackerService} from './savingsTracker';
export type {SavingsRecord, Achievement, UserStats} from './savingsTracker';

// Items Service
export {itemsService} from './itemsService';
export type {AggregatedItem, ItemPrice} from './itemsService';
export {migrateItemsAggregation, needsItemsMigration} from './itemsMigration';

// Phase 1.2 Services
export {shoppingListService} from './shoppingList';
export {userBehaviorService} from './userBehaviorService';
export {recommendationEngineService} from './recommendationEngineService';
export type {
  ShoppingList,
  ShoppingListItem,
  OptimizationResult,
  StoreRecommendation,
} from './shoppingList';
