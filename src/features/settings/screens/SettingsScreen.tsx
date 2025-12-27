// Settings Screen - Urbanist Design System
// Sleek, professional settings with soft pastels
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth, useUser, useSubscription, useTheme, useToast} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {biometricService, BiometricStatus} from '@/shared/services/biometric';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn, AppFooter, BackButton, Modal, Input, Button, ConfirmationModal} from '@/shared/components';
import {useDynamicType, useOffline} from '@/shared/hooks';
import {SUBSCRIPTION_PLANS, TRIAL_SCAN_LIMIT} from '@/shared/utils/constants';
import {formatDate} from '@/shared/utils/helpers';
import {receiptStorageService} from '@/shared/services/firebase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showArrow?: boolean;
  danger?: boolean;
  iconBgColor?: string;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showArrow = true,
  danger = false,
  iconBgColor,
}: SettingItemProps) {
  // Determine if background is dark (cosmos, red, crimson)
  const isDarkBg = iconBgColor && (
    iconBgColor === Colors.card.cosmos || 
    iconBgColor === Colors.card.crimson || 
    iconBgColor === Colors.card.red
  );
  const iconColor = danger 
    ? Colors.status.error 
    : isDarkBg 
      ? Colors.text.inverse 
      : Colors.text.primary;
  
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}>
      <View
        style={[
          styles.settingIconWrapper,
          danger && styles.settingIconWrapperDanger,
          iconBgColor ? {backgroundColor: iconBgColor} : undefined,
        ].filter(Boolean)}>
        <Icon
          name={icon}
          size="sm"
          color={iconColor}
        />
      </View>
      <View style={styles.settingContent}>
        <Text
          style={[styles.settingTitle, danger && styles.settingTitleDanger]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement}
      {showArrow && onPress && (
        <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
      )}
    </TouchableOpacity>
  );
}

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, signOut, isAuthenticated} = useAuth();
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const {profile, toggleNotifications, togglePriceAlerts} = useUser();
  const {showToast} = useToast();
  const {subscription, trialScansUsed} = useSubscription();
  const {isOnline, isSyncing, pendingActions, lastSyncTime, syncNow, clearQueue} = useOffline();
  const {isDarkMode, toggleTheme, themeMode, setThemeMode} = useTheme();
  const {fontScale, isLargeText, shouldReduceMotion} = useDynamicType();
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [togglingBiometric, setTogglingBiometric] = useState(false);

  // Check biometric status on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const status = await biometricService.getStatus();
      setBiometricStatus(status);
    };
    checkBiometric();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Use profile settings or defaults
  const notificationsEnabled = profile?.notificationsEnabled ?? true;
  const priceAlertsEnabled = profile?.priceAlertsEnabled ?? true;

  const currentPlan = subscription?.planId
    ? SUBSCRIPTION_PLANS[subscription.planId]
    : SUBSCRIPTION_PLANS.free;

  const trialRemaining = Math.max(0, TRIAL_SCAN_LIMIT - trialScansUsed);

  const handleToggleNotifications = async (value: boolean) => {
    try {
      await toggleNotifications(value);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier les notifications');
    }
  };

  const handleTogglePriceAlerts = async (value: boolean) => {
    try {
      await togglePriceAlerts(value);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier les alertes de prix');
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (togglingBiometric) return;
    
    setTogglingBiometric(true);
    try {
      if (value) {
        // Enable biometric
        if (!biometricStatus?.isAvailable) {
          Alert.alert(
            'Non disponible',
            'La biométrie n\'est pas disponible sur cet appareil.',
          );
          setTogglingBiometric(false);
          return;
        }

        // Prompt for password to enable
        Alert.prompt(
          'Activer la connexion biométrique',
          'Entrez votre mot de passe pour activer la connexion biométrique',
          [
            {text: 'Annuler', style: 'cancel'},
            {
              text: 'Activer',
              onPress: async (password) => {
                if (!password || password.length < 6) {
                  showToast('Mot de passe invalide', 'error');
                  setTogglingBiometric(false);
                  return;
                }

                const result = await biometricService.enable(
                  user?.uid || '',
                  {
                    phoneNumber: profile?.phoneNumber,
                    email: user?.email || profile?.email,
                    password: password,
                  },
                );

                if (result.success) {
                  showToast('Connexion biométrique activée', 'success');
                  const newStatus = await biometricService.getStatus();
                  setBiometricStatus(newStatus);
                } else {
                  Alert.alert('Erreur', result.error || 'Impossible d\'activer');
                }
                setTogglingBiometric(false);
              },
            },
          ],
          'secure-text',
        );
      } else {
        // Disable biometric
        const result = await biometricService.disable();
        if (result.success) {
          showToast('Connexion biométrique désactivée', 'success');
          const newStatus = await biometricService.getStatus();
          setBiometricStatus(newStatus);
        } else {
          Alert.alert('Erreur', result.error || 'Impossible de désactiver');
        }
        setTogglingBiometric(false);
      }
    } catch (error: any) {
      console.error('Biometric toggle error:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
      setTogglingBiometric(false);
    }
  };

  const handleSignOut = () => {
    setShowLogoutModal(true);
  };

  const confirmSignOut = async () => {
    setShowLogoutModal(false);
    await signOut();
    // Navigate to Home tab after sign out by resetting to Main
    navigation.reset({
      index: 0,
      routes: [{name: 'Main'}],
    });
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Supprimer mes données',
      'Cette action supprimera toutes vos factures scannées. Vos articles et listes de courses seront conservés.',
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) {
              showToast('Utilisateur non connecté', 'error');
              return;
            }

            setIsDeletingData(true);
            try {
              const count = await receiptStorageService.deleteAllReceipts(user.uid);
              showToast(
                `${count} facture${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''} avec succès`,
                'success',
                3000,
              );
            } catch (error) {
              console.error('Error deleting receipts:', error);
              showToast(
                'Impossible de supprimer les données. Veuillez réessayer.',
                'error',
              );
            } finally {
              setIsDeletingData(false);
            }
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    setShowDeleteAccountModal(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe');
      return;
    }

    setIsDeletingAccount(true);
    try {
      // Re-authenticate user before deleting account
      const auth = require('@react-native-firebase/auth').default;
      const credential = auth.EmailAuthProvider.credential(
        user?.email || '',
        deletePassword
      );
      
      await auth().currentUser?.reauthenticateWithCredential(credential);

      // Delete user account from Firebase Auth
      await auth().currentUser?.delete();

      // Sign out and navigate
      await signOut();
      
      setShowDeleteAccountModal(false);
      setDeletePassword('');
      
      Alert.alert(
        'Compte supprimé',
        'Votre compte a été supprimé définitivement.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Error deleting account:', error);
      let errorMessage = 'Impossible de supprimer le compte';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Mot de passe incorrect';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Identifiants invalides';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Veuillez vous reconnecter avant de supprimer votre compte';
      }
      
      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleContactSupport = () => {
    Linking.openURL(
      'mailto:support@goshopperai.com?subject=Support Prix Tracker',
    );
  };

  const handleRateApp = () => {
    // TODO: Link to app store
    Alert.alert('Merci !', 'Votre avis nous aide beaucoup !');
  };

  const handlePrivacyPolicy = () => {
    navigation.push('PrivacyPolicy');
  };

  const handleTermsOfService = () => {
    navigation.push('TermsOfService');
  };

  const handleForceSync = async () => {
    if (isSyncing) return;
    
    try {
      await syncNow();
      showToast('Synchronisation terminée avec succès', 'success', 3000);
    } catch (error) {
      showToast('Impossible de synchroniser. Vérifiez votre connexion.', 'error');
    }
  };

  const handleClearQueue = () => {
    Alert.alert(
      'Vider la file d\'attente',
      'Êtes-vous sûr de vouloir supprimer toutes les données en attente de synchronisation ?',
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await clearQueue();
            Alert.alert('File vidée', 'Toutes les données en attente ont été supprimées.');
          },
        },
      ]
    );
  };

  const getSyncStatusText = () => {
    if (isSyncing) return 'Synchronisation en cours...';
    if (!isOnline) return 'Hors ligne';
    if (pendingActions > 0) return `${pendingActions} action${pendingActions > 1 ? 's' : ''} en attente`;
    return 'Synchronisé';
  };

  const getSyncSubtitle = () => {
    if (!lastSyncTime) return 'Jamais synchronisé';
    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffMinutes < 1440) return `Il y a ${Math.floor(diffMinutes / 60)} h`;
    return `Il y a ${Math.floor(diffMinutes / 1440)} j`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <SlideIn delay={100}>
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => navigation.push('UpdateProfile')}
            activeOpacity={0.9}>
            <LinearGradient
              colors={[Colors.card.cream, '#FFFFFF']}
              style={styles.profileGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <View style={styles.profileAvatar}>
                <Icon name="user" size="lg" color={Colors.text.primary} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {user?.displayName || profile?.firstName || 'Utilisateur'}
                </Text>
                <Text style={styles.profileEmail}>
                  {user?.email || `ID: ${user?.id?.slice(0, 8)}...`}
                </Text>
              </View>
              <View style={styles.editButton}>
                <Icon name="edit" size="sm" color={Colors.text.primary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </SlideIn>

        {/* Subscription Card */}
        <SlideIn delay={200}>
          <TouchableOpacity
            style={styles.subscriptionCard}
            onPress={() => navigation.push('Subscription')}
            activeOpacity={0.9}>
            <LinearGradient
              colors={[Colors.card.crimson, Colors.card.red]}
              style={styles.subscriptionGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <View style={styles.subscriptionGlow} />
              <View style={styles.subscriptionHeader}>
                <View style={styles.subscriptionBadge}>
                  <Icon name="crown" size="xs" color={Colors.accent} />
                  <Text style={styles.subscriptionBadgeText}>
                    {currentPlan.name}
                  </Text>
                </View>
                <Icon
                  name="chevron-right"
                  size="sm"
                  color="rgba(255,255,255,0.8)"
                />
              </View>

              {subscription?.planId === 'free' ? (
                <View style={styles.trialProgress}>
                  <Text style={styles.trialText}>
                    Essai: {trialRemaining}/{TRIAL_SCAN_LIMIT} scans restants
                  </Text>
                  <View style={styles.trialBar}>
                    <View
                      style={[
                        styles.trialBarFill,
                        {
                          width: `${
                            (trialRemaining / TRIAL_SCAN_LIMIT) * 100
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : (
                <Text style={styles.subscriptionExpiry}>
                  Expire le:{' '}
                  {subscription?.expiryDate
                    ? formatDate(subscription.expiryDate)
                    : 'Illimité'}
                </Text>
              )}

              <View style={styles.upgradeButton}>
                <Text style={styles.upgradeText}>
                  {subscription?.planId === 'premium'
                    ? 'Gérer mon abonnement'
                    : 'Passer à Premium'}
                </Text>
                <Icon name="arrow-right" size="xs" color={Colors.accent} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </SlideIn>

        {/* Settings Sections */}
        <SlideIn delay={300}>
          <SettingSection title="Sécurité">
            {biometricStatus?.isAvailable && (
              <SettingItem
                icon={biometricService.getBiometryIcon(biometricStatus.biometryType)}
                title={`Connexion ${biometricService.getBiometryDisplayName(biometricStatus.biometryType)}`}
                subtitle={
                  biometricStatus.isEnabled
                    ? 'Activée'
                    : 'Connectez-vous rapidement et en toute sécurité'
                }
                showArrow={false}
                iconBgColor={Colors.card.cosmos}
                rightElement={
                  <Switch
                    value={biometricStatus.isEnabled}
                    onValueChange={handleToggleBiometric}
                    disabled={togglingBiometric}
                    trackColor={{
                      false: Colors.border.light,
                      true: Colors.primary,
                    }}
                    thumbColor={'#ffffff'}
                  />
                }
              />
            )}
          </SettingSection>
        </SlideIn>

        <SlideIn delay={350}>
          <SettingSection title="Préférences">
            <SettingItem
              icon="moon"
              title="Apparence"
              subtitle={
                themeMode === 'system' 
                  ? 'Automatique (Système)' 
                  : themeMode === 'dark' 
                    ? 'Mode sombre' 
                    : 'Mode clair'
              }
              showArrow={true}
              iconBgColor={Colors.card.cosmos}
              onPress={() => {
                Alert.alert(
                  'Apparence',
                  'Choisissez le thème de l\'application',
                  [
                    {
                      text: 'Système (Auto)',
                      onPress: () => setThemeMode('system'),
                    },
                    {
                      text: 'Mode clair',
                      onPress: () => setThemeMode('light'),
                    },
                    {
                      text: 'Mode sombre',
                      onPress: () => setThemeMode('dark'),
                    },
                    {
                      text: 'Annuler',
                      style: 'cancel',
                    },
                  ],
                );
              }}
            />
            <SettingItem
              icon="type"
              title="Taille du texte"
              subtitle={`${Math.round(fontScale * 100)}% ${isLargeText ? '(Grande taille)' : ''}`}
              showArrow={true}
              iconBgColor={Colors.card.blue}
              onPress={() => {
                Alert.alert(
                  'Taille du texte',
                  `L'application utilise automatiquement la taille de texte définie dans les réglages de votre téléphone.\n\nÉchelle actuelle: ${Math.round(fontScale * 100)}%\n${shouldReduceMotion ? 'Animations réduites: Activées' : ''}`,
                  [
                    {
                      text: 'Ouvrir les réglages',
                      onPress: () => Linking.openSettings(),
                    },
                    {
                      text: 'OK',
                      style: 'cancel',
                    },
                  ],
                );
              }}
            />
            <SettingItem
              icon="bell"
              title="Notifications"
              subtitle={notificationsEnabled ? 'Activées' : 'Désactivées'}
              showArrow={false}
              iconBgColor={Colors.card.crimson}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{
                    false: Colors.border.light,
                    true: Colors.primary,
                  }}
                  thumbColor={'#ffffff'}
                />
              }
            />
            <SettingItem
              icon="trending-up"
              title="Alertes de prix"
              subtitle="Gérer vos alertes de prix"
              showArrow={true}
              iconBgColor={Colors.card.cream}
              onPress={() => navigation.push('PriceAlerts')}
            />
          </SettingSection>
        </SlideIn>

        <SlideIn delay={400}>
          <SettingSection title="Synchronisation">
            <SettingItem
              icon={isSyncing ? "refresh" : isOnline ? "cloud" : "cloud-off"}
              title="Statut de synchronisation"
              subtitle={getSyncSubtitle()}
              iconBgColor={isOnline ? Colors.card.blue : Colors.card.red}
              rightElement={
                <Text style={[
                  styles.syncStatusText,
                  !isOnline && styles.syncStatusOffline,
                  isSyncing && styles.syncStatusSyncing
                ]}>
                  {getSyncStatusText()}
                </Text>
              }
              showArrow={false}
            />
            {pendingActions > 0 && (
              <SettingItem
                icon="upload"
                title="Forcer la synchronisation"
                subtitle={`${pendingActions} action${pendingActions > 1 ? 's' : ''} en attente`}
                iconBgColor={Colors.card.cream}
                onPress={handleForceSync}
              />
            )}
            {pendingActions > 0 && (
              <SettingItem
                icon="trash-2"
                title="Vider la file d'attente"
                subtitle="Supprimer toutes les données en attente"
                iconBgColor={Colors.card.red}
                onPress={handleClearQueue}
                danger={true}
              />
            )}
          </SettingSection>
        </SlideIn>

        <SlideIn delay={450}>
          <SettingSection title="Support">
            <SettingItem
              icon="message"
              title="Contacter le support"
              subtitle="support@goshopperai.com"
              iconBgColor={Colors.card.blue}
              onPress={handleContactSupport}
            />
            <SettingItem
              icon="star"
              title="Noter l'application"
              subtitle="Donnez-nous 5 étoiles !"
              iconBgColor={Colors.card.cream}
              onPress={handleRateApp}
            />
            <SettingItem
              icon="help"
              title="FAQ"
              subtitle="Questions fréquentes"
              iconBgColor={Colors.card.red}
              onPress={() => navigation.push('FAQ')}
            />
          </SettingSection>
        </SlideIn>

        <SlideIn delay={650}>
          <SettingSection title="Compte">
            <SettingItem
              icon="trash"
              title="Supprimer mes données"
              subtitle={isDeletingData ? 'Suppression en cours...' : 'Supprimer factures (conserve articles et listes)'}
              onPress={isDeletingData ? undefined : handleDeleteData}
              danger
            />
            <SettingItem
              icon="user-x"
              title="Supprimer mon compte"
              subtitle="Supprimer définitivement le compte"
              onPress={handleDeleteAccount}
              danger
            />
            <SettingItem
              icon="logout"
              title="Déconnexion"
              onPress={handleSignOut}
              danger
            />
          </SettingSection>
        </SlideIn>

        {/* App Footer */}
        <FadeIn delay={700}>
          <AppFooter />
        </FadeIn>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccountModal}
        variant="bottom-sheet"
        size="large"
        title="Supprimer mon compte"
        onClose={() => {
          setShowDeleteAccountModal(false);
          setDeletePassword('');
          setShowPassword(false);
        }}>
        <ScrollView>
          <View style={styles.deleteModalContent}>
            <Icon name="alert-triangle" size="xl" color={Colors.status.error} />
            
            <Text style={styles.deleteModalTitle}>
              Êtes-vous absolument sûr ?
            </Text>
            
            <Text style={styles.deleteModalText}>
              Cette action est <Text style={styles.deleteModalBold}>irréversible</Text>.
              Toutes vos données seront définitivement supprimées :
            </Text>
            
            <View style={styles.deleteModalList}>
              <View style={styles.deleteModalListItem}>
                <Icon name="check" size="sm" color={Colors.text.secondary} />
                <Text style={styles.deleteModalListText}>Toutes vos factures</Text>
              </View>
              <View style={styles.deleteModalListItem}>
                <Icon name="check" size="sm" color={Colors.text.secondary} />
                <Text style={styles.deleteModalListText}>Vos listes de courses</Text>
              </View>
              <View style={styles.deleteModalListItem}>
                <Icon name="check" size="sm" color={Colors.text.secondary} />
                <Text style={styles.deleteModalListText}>Votre historique</Text>
              </View>
              <View style={styles.deleteModalListItem}>
                <Icon name="check" size="sm" color={Colors.text.secondary} />
                <Text style={styles.deleteModalListText}>Votre abonnement</Text>
              </View>
            </View>

            <View style={styles.deleteModalInputContainer}>
              <Text style={styles.deleteModalInputLabel}>
                Pour confirmer, entrez votre mot de passe :
              </Text>
              <Input
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Mot de passe"
                secureTextEntry={!showPassword}
                leftIcon="lock"
                rightIcon={showPassword ? "eye-off" : "eye"}
                onRightIconPress={() => setShowPassword(!showPassword)}
                autoFocus
                editable={!isDeletingAccount}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.deleteModalActions}>
              <Button
                title="Annuler"
                onPress={() => {
                  setShowDeleteAccountModal(false);
                  setDeletePassword('');
                  setShowPassword(false);
                }}
                variant="secondary"
                fullWidth
                disabled={isDeletingAccount}
              />
              <Button
                title="Supprimer définitivement"
                onPress={handleConfirmDeleteAccount}
                loading={isDeletingAccount}
                disabled={!deletePassword.trim() || isDeletingAccount}
                variant="danger"
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Déconnexion"
        message="Êtes-vous sûr de vouloir vous déconnecter ?"
        icon="logout"
        variant="danger"
        confirmText="Déconnecter"
        cancelText="Annuler"
        onConfirm={confirmSignOut}
        onCancel={() => setShowLogoutModal(false)}
      />
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
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },

  // Profile Card
  profileCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Subscription Card
  subscriptionCard: {
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  subscriptionGradient: {
    padding: Spacing.lg,
  },
  subscriptionGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.accent,
    opacity: 0.15,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  subscriptionBadgeText: {
    color: '#ffffff',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trialProgress: {
    marginBottom: Spacing.md,
  },
  trialText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
  },
  trialBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  trialBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
  },
  subscriptionExpiry: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  upgradeText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },

  // Setting Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },

  // Setting Item
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  settingIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingIconWrapperDanger: {
    backgroundColor: `${Colors.status.error}15`,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  settingTitleDanger: {
    color: Colors.status.error,
  },
  settingSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },

  // Sync Status
  syncStatusText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },
  syncStatusOffline: {
    color: Colors.status.error,
  },
  syncStatusSyncing: {
    color: Colors.primary,
  },

  // App Info
  appInfo: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  appLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.card.red,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  appVersion: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  appCopyright: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
  },

  // Delete Account Modal
  deleteModalContent: {
    padding: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  deleteModalText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  deleteModalBold: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.status.error,
  },
  deleteModalList: {
    width: '100%',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  deleteModalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  deleteModalListText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  deleteModalInputContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  deleteModalInputLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  deleteModalActions: {
    width: '100%',
    gap: Spacing.md,
  },
});
