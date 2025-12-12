// Sign In Screen - Google and Apple authentication
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {SocialSignInButtons} from '@/shared/components';
import {Colors, Typography, Spacing, BorderRadius} from '@/shared/theme/theme';

// Urbanist Design Colors
const URBANIST_COLORS = {
  background: '#F6F5FA',
  cardBg: '#FFFFFF',
  primaryAccent: '#D8DFE9',
  secondaryAccent: '#CFDECA',
  highlightAccent: '#EFF0A3',
  textPrimary: '#212121',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#8B5CF6',
  border: '#E5E7EB',
};

export function SignInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {signInWithGoogle, signInWithApple, isLoading, error} = useAuth();
  const {showToast} = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) {
      return;
    }

    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      showToast('Connexion réussie avec Google', 'success');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      showToast(err?.message || 'Échec de la connexion Google', 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isSigningIn) {
      return;
    }

    setIsSigningIn(true);
    try {
      await signInWithApple();
      showToast('Connexion réussie avec Apple', 'success');
    } catch (err: any) {
      console.error('Apple sign-in error:', err);
      showToast(err?.message || 'Échec de la connexion Apple', 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSkipSignIn = () => {
    // Navigate to main app without authentication
    navigation.navigate('MainTab' as never);
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={URBANIST_COLORS.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleSkipSignIn}
          style={styles.skipButton}
          activeOpacity={0.7}>
          <Text style={styles.skipText}>Ignorer</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 24},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Text style={styles.welcomeText}>Bienvenue sur</Text>
          <Text style={styles.appName}>GoShopperAI</Text>
          <Text style={styles.description}>
            Votre assistant intelligent pour économiser sur vos courses au
            quotidien
          </Text>
        </View>

        {/* Sign In Card */}
        <View style={styles.signInCard}>
          <Text style={styles.signInTitle}>Se connecter</Text>
          <Text style={styles.signInSubtitle}>
            Choisissez votre méthode de connexion préférée
          </Text>

          <SocialSignInButtons
            onGoogleSignIn={handleGoogleSignIn}
            onAppleSignIn={handleAppleSignIn}
            isLoading={isSigningIn || isLoading}
          />

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Footer - Terms */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            En vous connectant, vous acceptez nos{' '}
            <Text
              style={styles.linkText}
              onPress={() => navigation.navigate('TermsOfService')}>
              Conditions d'utilisation
            </Text>{' '}
            et notre{' '}
            <Text
              style={styles.linkText}
              onPress={() => navigation.navigate('PrivacyPolicy')}>
              Politique de confidentialité
            </Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: URBANIST_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: URBANIST_COLORS.cardBg,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  skipText: {
    fontSize: 14,
    color: URBANIST_COLORS.textSecondary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 18,
    color: URBANIST_COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  appName: {
    fontSize: 36,
    color: URBANIST_COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: URBANIST_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  signInCard: {
    backgroundColor: URBANIST_COLORS.cardBg,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 32,
  },
  signInTitle: {
    fontSize: 22,
    color: URBANIST_COLORS.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  signInSubtitle: {
    fontSize: 14,
    color: URBANIST_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 13,
    color: URBANIST_COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: URBANIST_COLORS.primary,
    fontWeight: '600',
  },
});
