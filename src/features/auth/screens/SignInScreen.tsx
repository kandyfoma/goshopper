// Sign In Screen - Google and Apple authentication
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useAuth} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {SocialSignInButtons} from '@/shared/components';
import {Colors, Typography, Spacing, BorderRadius} from '@/shared/theme/theme';
import Icon from '@/shared/components/Icon';

export function SignInScreen() {
  const navigation = useNavigation();
  const {signInWithGoogle, signInWithApple, isLoading, error} = useAuth();
  const {showToast} = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      showToast('Connexion réussie avec Google', 'success');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      showToast(
        error.message || 'Échec de la connexion Google',
        'error'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    try {
      await signInWithApple();
      showToast('Connexion réussie avec Apple', 'success');
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      showToast(
        error.message || 'Échec de la connexion Apple',
        'error'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSkipSignIn = () => {
    // Navigate to main app without authentication
    navigation.navigate('MainTab' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleSkipSignIn}
          style={styles.skipButton}>
          <Text style={styles.skipText}>Ignorer</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Icon name="shopping-bag" size="3xl" color={Colors.primary} />
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Bienvenue sur</Text>
          <Text style={styles.subtitle}>GoShopperAI</Text>
          <Text style={styles.description}>
            Votre assistant intelligent pour faire des courses
          </Text>
        </View>

        {/* Sign In Options */}
        <View style={styles.signInContainer}>
          <Text style={styles.signInTitle}>Se connecter avec</Text>

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

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            En vous connectant, vous acceptez nos{' '}
            <Text style={styles.linkText}>Conditions d'utilisation</Text> et{' '}
            <Text style={styles.linkText}>Politique de confidentialité</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  skipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  skipText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.regular,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize['3xl'],
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed,
  },
  signInContainer: {
    marginTop: Spacing.xl,
  },
  signInTitle: {
    fontSize: Typography.fontSize.lg,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  errorContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.status.errorLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.status.error,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.status.error,
    textAlign: 'center',
  },
  footer: {
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.normal,
  },
  linkText: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});