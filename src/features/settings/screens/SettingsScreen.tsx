// Settings Screen - Urbanist Design System
// Sleek, professional settings with soft pastels
import React, {useEffect, useState, useRef} from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth, useUser, useSubscription, useTheme, useToast} from '@/shared/contexts';
import {useScroll} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {biometricService, BiometricStatus} from '@/shared/services/biometric';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn, AppFooter, BackButton, Modal, Input, Button, ConfirmationModal, AnimatedModal} from '@/shared/components';
import {ModernTabBar, TabBarIcon} from '@/shared/components/ModernTabBar';
import {useDynamicType, useOffline} from '@/shared/hooks';
import {SUBSCRIPTION_PLANS, TRIAL_SCAN_LIMIT} from '@/shared/utils/constants';
import {formatDate} from '@/shared/utils/helpers';
import {receiptStorageService, authService} from '@/shared/services/firebase';

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
  const {scrollY} = useScroll();
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showClearQueueModal, setShowClearQueueModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showRateAppModal, setShowRateAppModal] = useState(false);
  const {profile, toggleNotifications, togglePriceAlerts} = useUser();
  const {showToast} = useToast();
  const {
    subscription,
    trialScansUsed,
    scansRemaining,
    isTrialActive,
    trialDaysRemaining,
    isExpiringSoon,
    daysUntilExpiration,
  } = useSubscription();
  const {isOnline, isSyncing, pendingActions, lastSyncTime, syncNow, clearQueue} = useOffline();
  const {isDarkMode, toggleTheme, themeMode, setThemeMode} = useTheme();
  const {fontScale, isLargeText, shouldReduceMotion} = useDynamicType();
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [togglingBiometric, setTogglingBiometric] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

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
    : SUBSCRIPTION_PLANS.freemium;

  // Determine if user is on a free/trial plan
  const isFreePlan = !subscription?.isSubscribed || 
    subscription?.status === 'freemium' || 
    subscription?.planId === 'freemium' ||
    isTrialActive;

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
    setShowDeleteDataModal(true);
  };

  const confirmDeleteData = async () => {
    if (!user?.uid) {
      showToast('Utilisateur non connecté', 'error');
      return;
    }

    setIsDeletingData(true);
    try {
      const count = await receiptStorageService.deleteAllReceipts(user.uid);
      setShowDeleteDataModal(false);
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
      // Use auth service to delete account (handles both Firebase Auth and phone users)
      await authService.deleteAccount(user!.uid, deletePassword);

      setShowDeleteAccountModal(false);
      setDeletePassword('');
      
      // Show toast notification instead of alert
      showToast('Votre compte a été supprimé définitivement.', 'success', 4000);
      
      // Sign out - this will automatically navigate to auth screens via RootNavigator
      await signOut();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      let errorMessage = 'Impossible de supprimer le compte';
      
      if (error.message === 'Invalid password') {
        errorMessage = 'Mot de passe incorrect';
      } else if (error.code === 'auth/wrong-password') {
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
    setShowRateAppModal(true);
  };

  const handlePrivacyPolicy = () => {
    navigation.push('PrivacyPolicy');
  };

  const handleTermsOfService = () => {
    navigation.push('TermsOfService');
  };

  const handleForceSync = async () => {
    if (isSyncing) return;
    
    if (pendingActions === 0) {
      showToast('Aucune donnée en attente de synchronisation', 'info', 3000);
      return;
    }
    
    try {
      await syncNow();
      showToast('Synchronisation terminée avec succès', 'success', 3000);
    } catch (error) {
      showToast('Impossible de synchroniser. Vérifiez votre connexion.', 'error');
    }
  };

  const handleClearQueue = () => {
    setShowClearQueueModal(true);
  };

  const confirmClearQueue = async () => {
    try {
      await clearQueue();
      setShowClearQueueModal(false);
      showToast('File vidée', 'success', 3000);
    } catch (error) {
      showToast('Erreur lors du vidage de la file', 'error');
    }
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
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: false}
        )}
        scrollEventThrottle={16}
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

              {isFreePlan || isTrialActive ? (
                <View style={styles.trialProgress}>
                  <Text style={styles.trialText}>
                    {isTrialActive 
                      ? `Essai: ${scansRemaining} scans restants (${trialDaysRemaining} jours)`
                      : `Freemium: ${scansRemaining} scans restants`
                    }
                  </Text>
                  <View style={styles.trialBar}>
                    <View
                      style={[
                        styles.trialBarFill,
                        {
                          width: `${Math.min(100, (scansRemaining / (isTrialActive ? TRIAL_SCAN_LIMIT : 3)) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.subscriptionExpiry}>
                    {isExpiringSoon && daysUntilExpiration > 0 ? (
                      <Text style={styles.expiryWarning}>
                        Expire dans {daysUntilExpiration} jour{daysUntilExpiration > 1 ? 's' : ''}
                      </Text>
                    ) : subscription?.subscriptionEndDate ? (
                      `Expire le: ${formatDate(subscription.subscriptionEndDate)}`
                    ) : (
                      'Actif'
                    )}
                  </Text>
                  <Text style={styles.scansInfo}>
                    {scansRemaining} scan{scansRemaining > 1 ? 's' : ''} restant{scansRemaining > 1 ? 's' : ''}
                  </Text>
                </>
              )}

              <View style={styles.upgradeButton}>
                <Text style={styles.upgradeText}>
                  {subscription?.planId === 'premium'
                    ? 'Gérer mon abonnement'
                    : subscription?.isSubscribed
                    ? 'Améliorer mon plan'
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
              onPress={() => setShowThemeModal(true)}
            />
            <SettingItem
              icon="type"
              title="Taille du texte"
              subtitle={`${Math.round(fontScale * 100)}% ${isLargeText ? '(Grande taille)' : ''}`}
              showArrow={true}
              iconBgColor={Colors.card.blue}
              onPress={() => setShowFontSizeModal(true)}
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
            <SettingItem
              icon="upload"
              title="Forcer la synchronisation"
              subtitle={
                pendingActions > 0 
                  ? `${pendingActions} action${pendingActions > 1 ? 's' : ''} en attente`
                  : 'Aucune action en attente'
              }
              iconBgColor={Colors.card.cream}
              onPress={handleForceSync}
            />
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
        
        {/* Bottom padding for tab bar */}
        <View style={{height: 100}} />
      </ScrollView>

      {/* Main Footer Tabs */}
      <ModernTabBar
        state={{
          index: 4, // Profile tab active
          routes: [
            {key: 'Home', name: 'Home'},
            {key: 'Items', name: 'Items'},
            {key: 'Scanner', name: 'Scanner'},
            {key: 'Stats', name: 'Stats'},
            {key: 'Profile', name: 'Profile'},
          ],
        }}
        descriptors={{
          Home: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="home" label="Accueil" />}},
          Items: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="shopping-bag" label="Articles" />}},
          Scanner: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="camera" label="Scanner" />}},
          Stats: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="bar-chart-2" label="Stats" />}},
          Profile: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="user" label="Profil" />}},
        }}
        navigation={navigation}
        badges={{}}
        scrollY={scrollY}
      />

      {/* Delete Data Modal */}
      <AnimatedModal
        visible={showDeleteDataModal}
        onClose={() => setShowDeleteDataModal(false)}
        variant="centered"
        overlayOpacity={0.4}>
        {/* Close button */}
        <TouchableOpacity 
          style={styles.confirmCloseButton} 
          onPress={() => setShowDeleteDataModal(false)}>
          <Icon name="x" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.confirmIconContainer}>
          <Icon name="trash-2" size="xl" color={Colors.white} />
        </View>
        
        <Text style={styles.confirmModalTitle}>
          Supprimer mes données
        </Text>
        
        <Text style={styles.confirmModalText}>
          Cette action supprimera toutes vos factures scannées. Vos articles et listes de courses seront conservés.
        </Text>

        <View style={styles.confirmModalActions}>
          <View style={{flex: 1}}>
            <Button
              title="Annuler"
              onPress={() => setShowDeleteDataModal(false)}
              variant="secondary"
              size="lg"
              disabled={isDeletingData}
            />
          </View>
          <View style={{flex: 1}}>
            <Button
              title="Supprimer"
              onPress={confirmDeleteData}
              variant="danger"
              size="lg"
              loading={isDeletingData}
              disabled={isDeletingData}
            />
          </View>
        </View>
      </AnimatedModal>

      {/* Clear Queue Modal */}
      <AnimatedModal
        visible={showClearQueueModal}
        onClose={() => setShowClearQueueModal(false)}
        variant="centered"
        overlayOpacity={0.4}>
        {/* Close button */}
        <TouchableOpacity 
          style={styles.confirmCloseButton} 
          onPress={() => setShowClearQueueModal(false)}>
          <Icon name="x" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.confirmIconContainer}>
          <Icon name="refresh-cw" size="xl" color={Colors.white} />
        </View>
        
        <Text style={styles.confirmModalTitle}>
          Vider la file d'attente
        </Text>
        
        <Text style={styles.confirmModalText}>
          Êtes-vous sûr de vouloir supprimer toutes les données en attente de synchronisation ?
        </Text>

        <View style={styles.confirmModalActions}>
          <View style={{flex: 1}}>
            <Button
              title="Annuler"
              onPress={() => setShowClearQueueModal(false)}
              variant="secondary"
              size="lg"
            />
          </View>
          <View style={{flex: 1}}>
            <Button
              title="Supprimer"
              onPress={confirmClearQueue}
              variant="danger"
              size="lg"
            />
          </View>
        </View>
      </AnimatedModal>

      {/* Delete Account Modal */}
      <AnimatedModal
        visible={showDeleteAccountModal}
        onClose={() => {
          setShowDeleteAccountModal(false);
          setDeletePassword('');
          setShowPassword(false);
        }}
        variant="bottom-sheet"
        overlayOpacity={0.5}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
          enabled
          style={{flex: 1}}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={styles.deleteModalScrollView}
            contentContainerStyle={styles.deleteModalScrollContent}>
            {/* Close button */}
            <TouchableOpacity 
              style={styles.deleteCloseButton} 
              onPress={() => {
                setShowDeleteAccountModal(false);
                setDeletePassword('');
                setShowPassword(false);
              }}>
              <Icon name="x" size="sm" color={Colors.text.tertiary} />
            </TouchableOpacity>
            
            <View style={styles.deleteModalContent}>
              {/* Icon */}
              <View style={styles.deleteIconContainer}>
                <Icon name="alert-triangle" size="xl" color={Colors.white} />
              </View>
              
              <Text style={styles.deleteModalTitle}>
                Supprimer mon compte
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
                <View style={{flex: 1}}>
                  <Button
                    title="Annuler"
                    onPress={() => {
                      setShowDeleteAccountModal(false);
                      setDeletePassword('');
                      setShowPassword(false);
                    }}
                    variant="secondary"
                    size="lg"
                    disabled={isDeletingAccount}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Button
                    title="Supprimer"
                    onPress={handleConfirmDeleteAccount}
                    loading={isDeletingAccount}
                    disabled={!deletePassword.trim() || isDeletingAccount}
                    variant="danger"
                    size="lg"
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </AnimatedModal>

      <AnimatedModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        variant="centered"
        overlayOpacity={0.4}>
        <TouchableOpacity 
          style={styles.confirmCloseButton} 
          onPress={() => setShowThemeModal(false)}>
          <Icon name="x" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.confirmIconContainer}>
          <Icon name="moon" size="xl" color={Colors.white} />
        </View>
        
        <Text style={styles.confirmModalTitle}>
          Apparence
        </Text>
        
        <Text style={styles.confirmModalText}>
          Choisissez le thème de l'application
        </Text>

        <View style={styles.optionModalButtons}>
          <Button
            title="Système (Auto)"
            onPress={() => {
              setThemeMode('system');
              setShowThemeModal(false);
            }}
            variant={themeMode === 'system' ? 'primary' : 'secondary'}
            size="lg"
          />
          <Button
            title="Mode clair"
            onPress={() => {
              setThemeMode('light');
              setShowThemeModal(false);
            }}
            variant={themeMode === 'light' ? 'primary' : 'secondary'}
            size="lg"
          />
          <Button
            title="Mode sombre"
            onPress={() => {
              setThemeMode('dark');
              setShowThemeModal(false);
            }}
            variant={themeMode === 'dark' ? 'primary' : 'secondary'}
            size="lg"
          />
        </View>
      </AnimatedModal>

      {/* Font Size Modal */}
      <AnimatedModal
        visible={showFontSizeModal}
        onClose={() => setShowFontSizeModal(false)}
        variant="centered"
        overlayOpacity={0.4}>
        <TouchableOpacity 
          style={styles.confirmCloseButton} 
          onPress={() => setShowFontSizeModal(false)}>
          <Icon name="x" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.confirmIconContainer}>
          <Icon name="type" size="xl" color={Colors.white} />
        </View>
        
        <Text style={styles.confirmModalTitle}>
          Taille du texte
        </Text>
        
        <Text style={styles.confirmModalText}>
          L'application utilise automatiquement la taille de texte définie dans les réglages de votre téléphone.{'\n\n'}
          Échelle actuelle: {Math.round(fontScale * 100)}%{'\n'}
          {shouldReduceMotion ? 'Animations réduites: Activées' : ''}
        </Text>

        <View style={styles.confirmModalActions}>
          <View style={{flex: 1}}>
            <Button
              title="Annuler"
              onPress={() => setShowFontSizeModal(false)}
              variant="secondary"
              size="lg"
            />
          </View>
          <View style={{flex: 1}}>
            <Button
              title="Réglages"
              onPress={() => {
                setShowFontSizeModal(false);
                Linking.openSettings();
              }}
              variant="primary"
              size="lg"
            />
          </View>
        </View>
      </AnimatedModal>

      {/* Rate App Modal */}
      <AnimatedModal
        visible={showRateAppModal}
        onClose={() => setShowRateAppModal(false)}
        variant="centered"
        overlayOpacity={0.4}>
        <TouchableOpacity 
          style={styles.confirmCloseButton} 
          onPress={() => setShowRateAppModal(false)}>
          <Icon name="x" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.confirmIconContainer}>
          <Icon name="star" size="xl" color={Colors.white} />
        </View>
        
        <Text style={styles.confirmModalTitle}>
          Merci !
        </Text>
        
        <Text style={styles.confirmModalText}>
          Votre avis nous aide beaucoup !
        </Text>

        <View style={styles.optionModalButtons}>
          <Button
            title="OK"
            onPress={() => setShowRateAppModal(false)}
            variant="primary"
            size="lg"
          />
        </View>
      </AnimatedModal>

      {/* Logout Confirmation Modal */}
      <AnimatedModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        variant="centered"
        overlayOpacity={0.4}>
        {/* Close button */}
        <TouchableOpacity 
          style={styles.logoutCloseButton} 
          onPress={() => setShowLogoutModal(false)}>
          <Icon name="x" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.logoutIconContainer}>
          <Icon name="logout" size="xl" color={Colors.white} />
        </View>
        
        <Text style={styles.logoutModalTitle}>
          Déconnexion
        </Text>
        
        <Text style={styles.logoutModalText}>
          Êtes-vous sûr de vouloir vous déconnecter ?
        </Text>

        <View style={styles.logoutModalActions}>
          <View style={{flex: 1}}>
            <Button
              title="Annuler"
              onPress={() => setShowLogoutModal(false)}
              variant="secondary"
              size="lg"
            />
          </View>
          <View style={{flex: 1}}>
            <Button
              title="OK"
              onPress={confirmSignOut}
              variant="primary"
              size="lg"
            />
          </View>
        </View>
      </AnimatedModal>
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
    marginBottom: Spacing.xs,
  },
  expiryWarning: {
    color: '#FFD700',
    fontWeight: Typography.fontWeight.semiBold,
  },
  scansInfo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.fontSize.xs,
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

  // Logout Modal
  logoutCloseButton: {
    position: 'absolute',
    top: -Spacing.md,
    right: -Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoutIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent, // Cosmos Blue #003049 - matches payment modal
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoutModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  logoutModalText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },

  // Confirmation Modals (Delete Data, Clear Queue)
  confirmCloseButton: {
    position: 'absolute',
    top: -Spacing.md,
    right: -Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  confirmIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  confirmModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  confirmModalText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  optionModalButtons: {
    width: '100%',
    gap: Spacing.md,
  },

  // Delete Account Modal
  deleteModalScrollView: {
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  deleteModalScrollContent: {
    paddingBottom: Platform.OS === 'ios' ? Spacing['4xl'] : Spacing['6xl'], // Extra padding for keyboard
    flexGrow: 1,
  },
  deleteCloseButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deleteIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.status.error, // Red for danger action
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  deleteModalContent: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  deleteModalText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
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
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    marginBottom: Spacing.lg,
  },
});
