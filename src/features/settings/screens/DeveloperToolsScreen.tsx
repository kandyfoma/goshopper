/**
 * Developer Tools Screen
 * Utilities for testing and debugging
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, BackButton} from '@/shared/components';
import {useAuth, useSubscription, useScanProcessing, useUser} from '@/shared/contexts';
import {itemsService, migrateItemsAggregation} from '@/shared/services/firebase';
import firestore from '@react-native-firebase/firestore';
import {APP_ID, COLLECTIONS} from '@/shared/services/firebase/config';

export function DeveloperToolsScreen() {
  const navigation = useNavigation();
  const {user} = useAuth();
  const {subscription, refreshSubscription} = useSubscription();
  const {profile} = useUser();
  const scanProcessing = useScanProcessing();
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeletingCityItems, setIsDeletingCityItems] = useState(false);
  const [isAddingTestScans, setIsAddingTestScans] = useState(false);
  const [isActivatingTestPremium, setIsActivatingTestPremium] = useState(false);

  // Check if user is authorized (admin)
  const isAuthorized = profile?.phoneNumber === '+243828812498';

  // If not authorized, show unauthorized message
  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>Developer Tools</Text>
        </View>
        <View style={[styles.content, {justifyContent: 'center', alignItems: 'center'}]}>
          <Icon name="lock" size="lg" color={Colors.text.tertiary} />
          <Text style={[styles.sectionTitle, {marginTop: Spacing.lg, textAlign: 'center'}]}>
            Access Denied
          </Text>
          <Text style={[styles.subtitle, {marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl}]}>
            You do not have permission to access developer tools.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleMigrateItems = async () => {
    Alert.alert(
      'Rebuild Items Aggregation',
      'This will rebuild all item statistics from your receipts. This may take a few minutes if you have many receipts. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Rebuild',
          style: 'default',
          onPress: async () => {
            try {
              setIsMigrating(true);
              const result = await migrateItemsAggregation();
              Alert.alert(
                'Migration Complete!',
                `Successfully aggregated ${result.itemsCount} items from ${result.receiptsProcessed} receipts.`,
                [{text: 'OK'}],
              );
            } catch (error) {
              console.error('Migration error:', error);
              Alert.alert(
                'Migration Failed',
                'Failed to rebuild items. Please try again later.',
                [{text: 'OK'}],
              );
            } finally {
              setIsMigrating(false);
            }
          },
        },
      ],
    );
  };

  const handleClearItemsCache = async () => {
    if (!user?.uid) return;

    Alert.alert(
      'Clear Items Cache',
      'This will clear the local cache and force a fresh load from the server. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await itemsService.clearCache(user.uid);
              Alert.alert(
                'Cache Cleared',
                'Items cache has been cleared. The next load will fetch fresh data.',
                [{text: 'OK'}],
              );
            } catch (error) {
              console.error('Clear cache error:', error);
              Alert.alert('Error', 'Failed to clear cache.', [{text: 'OK'}]);
            }
          },
        },
      ],
    );
  };

  const handleActivateTestPremium = async () => {
    if (!user?.uid) return;

    const isCurrentlyPremium = subscription?.isSubscribed === true;

    if (isCurrentlyPremium) {
      // Revert to freemium
      Alert.alert(
        'Revert to Freemium',
        'This will remove your test premium subscription and revert to freemium. Continue?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Revert',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsActivatingTestPremium(true);
                
                const now = new Date();
                const joinDate = subscription?.trialStartDate || subscription?.createdAt || now;
                const billingStart = new Date(joinDate);
                billingStart.setDate(1); // Start of current billing month
                const billingEnd = new Date(billingStart);
                billingEnd.setMonth(billingEnd.getMonth() + 1);
                billingEnd.setDate(0); // Last day of month

                await firestore()
                  .doc(COLLECTIONS.subscription(user.uid))
                  .update({
                    status: 'freemium',
                    planId: 'freemium',
                    isSubscribed: false,
                    scansRemaining: 5,
                    totalScansThisMonth: 0,
                    billingPeriodStart: billingStart,
                    billingPeriodEnd: billingEnd,
                    // Remove premium fields
                    subscriptionEndDate: firestore.FieldValue.delete(),
                    currentPeriodEnd: firestore.FieldValue.delete(),
                    cancelAtPeriodEnd: firestore.FieldValue.delete(),
                    updatedAt: now,
                  });

                await refreshSubscription();

                Alert.alert(
                  'Reverted to Freemium',
                  'Your subscription has been reverted to freemium tier (5 scans/month).',
                  [{text: 'OK'}],
                );
              } catch (error) {
                console.error('Revert premium error:', error);
                Alert.alert(
                  'Error',
                  `Failed to revert premium: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  [{text: 'OK'}],
                );
              } finally {
                setIsActivatingTestPremium(false);
              }
            },
          },
        ],
      );
    } else {
      // Activate test premium
      Alert.alert(
        'Activate Test Premium',
        'This will give you 1 month of premium access for testing. You can revert anytime. Continue?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Activate',
            style: 'default',
            onPress: async () => {
              try {
                setIsActivatingTestPremium(true);
                
                const now = new Date();
                const endDate = new Date(now);
                endDate.setMonth(endDate.getMonth() + 1);

                await firestore()
                  .doc(COLLECTIONS.subscription(user.uid))
                  .update({
                    status: 'active',
                    planId: 'premium',
                    isSubscribed: true,
                    scansRemaining: 999999, // Unlimited for premium
                    subscriptionEndDate: endDate,
                    currentPeriodEnd: endDate,
                    cancelAtPeriodEnd: false,
                    updatedAt: now,
                  });

                await refreshSubscription();

                Alert.alert(
                  'Test Premium Activated!',
                  `Premium subscription activated until ${endDate.toLocaleDateString('fr-FR')}. You now have unlimited scans and all premium features.`,
                  [{text: 'OK'}],
                );
              } catch (error) {
                console.error('Activate test premium error:', error);
                Alert.alert(
                  'Error',
                  `Failed to activate test premium: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  [{text: 'OK'}],
                );
              } finally {
                setIsActivatingTestPremium(false);
              }
            },
          },
        ],
      );
    }
  };

  const handleClearStuckScan = () => {
    Alert.alert(
      'Clear Stuck Scan',
      'This will reset any stuck processing state. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            scanProcessing.reset();
            Alert.alert(
              'Cleared!',
              'Stuck scan state has been reset.',
              [{text: 'OK'}],
            );
          },
        },
      ],
    );
  };

  const handleAddTestScans = async () => {
    Alert.alert(
      'Add Test Scans',
      'This will add 10 bonus scans for testing purposes. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsAddingTestScans(true);

              // Add bonus scans for testing
              const subscriptionRef = firestore()
                .doc(COLLECTIONS.subscription(user?.uid));

              await subscriptionRef.update({
                bonusScans: firestore.FieldValue.increment(10), // Add 10 bonus scans for testing
                updatedAt: firestore.FieldValue.serverTimestamp()
              });

              // Refresh subscription to update UI
              await refreshSubscription();

              Alert.alert(
                'Test Scans Added!',
                '10 bonus scans have been added to your account for testing purposes.',
                [{text: 'OK'}],
              );
            } catch (error) {
              console.error('Reset scans error:', error);
              Alert.alert(
                'Error',
                'Failed to reset scan count. Please try again.',
                [{text: 'OK'}],
              );
            } finally {
              setIsAddingTestScans(false);
            }
          },
        },
      ],
    );
  };

  const handleClearCityItems = async () => {
    Alert.alert(
      'Clear All City Items',
      '⚠️ WARNING: This will delete ALL cityItems from ALL cities in the database. This cannot be undone! Are you absolutely sure?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingCityItems(true);

              // Known cities in DRC
              const cities = [
                'Kinshasa',
                'Lubumbashi',
                'Mbuji-Mayi',
                'Kananga',
                'Kisangani',
                'Bukavu',
                'Goma',
                'Kolwezi',
                'Likasi',
                'Tshikapa',
              ];

              let totalDeleted = 0;

              // Delete cityItems for each city
              for (const city of cities) {
                const collectionPath = `artifacts/${APP_ID}/cityItems/${city}/items`;
                
                let shouldContinue = true;
                while (shouldContinue) {
                  // Get batch of documents
                  const snapshot = await firestore()
                    .collection(collectionPath)
                    .limit(500)
                    .get();

                  if (snapshot.empty) {
                    shouldContinue = false;
                    break;
                  }

                  // Delete in batch
                  const batch = firestore().batch();
                  snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                  });

                  await batch.commit();
                  totalDeleted += snapshot.docs.length;
                }
              }

              Alert.alert(
                'City Items Cleared!',
                `Successfully deleted ${totalDeleted} cityItems across all cities.`,
                [{text: 'OK'}],
              );
            } catch (error) {
              console.error('Clear city items error:', error);
              Alert.alert(
                'Error',
                `Failed to clear city items: ${error instanceof Error ? error.message : 'Unknown error'}`,
                [{text: 'OK'}],
              );
            } finally {
              setIsDeletingCityItems(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Developer Tools</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Testing</Text>
          <Text style={styles.sectionDescription}>
            Test premium features without payment
          </Text>

          <TouchableOpacity
            style={[
              styles.toolButton,
              subscription?.isSubscribed === true
                ? styles.successButton 
                : styles.premiumButton,
              isActivatingTestPremium && styles.toolButtonDisabled
            ]}
            onPress={handleActivateTestPremium}
            disabled={isActivatingTestPremium}
            activeOpacity={0.8}>
            <View style={[
              styles.toolIcon,
              subscription?.isSubscribed === true
                ? styles.successIcon
                : styles.premiumIcon
            ]}>
              {isActivatingTestPremium ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Icon 
                  name={subscription?.isSubscribed === true ? "check-circle" : "star"} 
                  size="md" 
                  color={subscription?.isSubscribed === true ? Colors.status.success : Colors.primary} 
                />
              )}
            </View>
            <View style={styles.toolInfo}>
              <Text style={[
                styles.toolTitle,
                subscription?.isSubscribed === true ? styles.successText : undefined
              ]}>
                {subscription?.isSubscribed === true
                  ? '✓ Test Premium Active'
                  : 'Activate Test Premium'}
              </Text>
              <Text style={styles.toolDescription}>
                {isActivatingTestPremium
                  ? 'Processing...'
                  : subscription?.isSubscribed === true
                  ? `Active until ${subscription?.subscriptionEndDate ? new Date(subscription.subscriptionEndDate).toLocaleDateString('fr-FR') : 'N/A'}. Tap to revert.`
                  : '1 month premium access for testing (can revert anytime)'}
              </Text>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scan Management</Text>
          <Text style={styles.sectionDescription}>
            Tools for managing scan limits and processing
          </Text>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={handleClearStuckScan}
            activeOpacity={0.8}>
            <View style={styles.toolIcon}>
              <Icon name="x-circle" size="md" color={Colors.status.warning} />
            </View>
            <View style={styles.toolInfo}>
              <Text style={styles.toolTitle}>Clear Stuck Scan</Text>
              <Text style={styles.toolDescription}>
                Reset any stuck processing banner from video scan
              </Text>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, styles.dangerButton, isAddingTestScans && styles.toolButtonDisabled]}
            onPress={handleAddTestScans}
            disabled={isAddingTestScans}
            activeOpacity={0.8}>
            <View style={[styles.toolIcon, styles.dangerIcon]}>
              {isAddingTestScans ? (
                <ActivityIndicator size="small" color={Colors.status.error} />
              ) : (
                <Icon name="plus" size="md" color={Colors.status.error} />
              )}
            </View>
            <View style={styles.toolInfo}>
              <Text style={[styles.toolTitle, styles.dangerText]}>Add Test Scans</Text>
              <Text style={styles.toolDescription}>
                {isAddingTestScans
                  ? 'Adding test scans...'
                  : 'Add 10 bonus scans for testing'}
              </Text>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Aggregation</Text>
          <Text style={styles.sectionDescription}>
            Tools for managing item statistics and aggregation
          </Text>

          <TouchableOpacity
            style={[styles.toolButton, isMigrating && styles.toolButtonDisabled]}
            onPress={handleMigrateItems}
            disabled={isMigrating}
            activeOpacity={0.8}>
            <View style={styles.toolIcon}>
              {isMigrating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Icon name="refresh-cw" size="md" color={Colors.primary} />
              )}
            </View>
            <View style={styles.toolInfo}>
              <Text style={styles.toolTitle}>Rebuild Items Aggregation</Text>
              <Text style={styles.toolDescription}>
                {isMigrating
                  ? 'Rebuilding items from receipts...'
                  : 'Recalculate all item statistics from your receipts'}
              </Text>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={handleClearItemsCache}
            activeOpacity={0.8}>
            <View style={styles.toolIcon}>
              <Icon name="trash-2" size="md" color={Colors.status.warning} />
            </View>
            <View style={styles.toolInfo}>
              <Text style={styles.toolTitle}>Clear Items Cache</Text>
              <Text style={styles.toolDescription}>
                Remove cached items and force fresh load
              </Text>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, styles.dangerButton, isDeletingCityItems && styles.toolButtonDisabled]}
            onPress={handleClearCityItems}
            disabled={isDeletingCityItems}
            activeOpacity={0.8}>
            <View style={[styles.toolIcon, styles.dangerIcon]}>
              {isDeletingCityItems ? (
                <ActivityIndicator size="small" color={Colors.status.error} />
              ) : (
                <Icon name="alert-triangle" size="md" color={Colors.status.error} />
              )}
            </View>
            <View style={styles.toolInfo}>
              <Text style={[styles.toolTitle, styles.dangerText]}>Clear All City Items</Text>
              <Text style={styles.toolDescription}>
                {isDeletingCityItems
                  ? 'Deleting city items...'
                  : '⚠️ Delete ALL cityItems from database (cannot be undone)'}
              </Text>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Icon name="info" size="sm" color={Colors.primary} />
          <Text style={styles.infoText}>
            These tools are for development and testing purposes. Use them only
            if you're experiencing issues with item data.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  toolButtonDisabled: {
    opacity: 0.6,
  },
  dangerButton: {
    borderWidth: 2,
    borderColor: Colors.status.error,
  },
  premiumButton: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  successButton: {
    borderWidth: 2,
    borderColor: Colors.status.success,
  },
  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  dangerIcon: {
    backgroundColor: 'rgba(249, 62, 62, 0.1)',
  },
  premiumIcon: {
    backgroundColor: 'rgba(88, 86, 214, 0.1)',
  },
  successIcon: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  toolInfo: {
    flex: 1,
  },
  toolTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  dangerText: {
    color: Colors.status.error,
  },
  successText: {
    color: Colors.status.success,
  },
  toolDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
});
