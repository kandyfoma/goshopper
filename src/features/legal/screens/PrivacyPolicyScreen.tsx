// Privacy Policy Screen - Urbanist Design System
// Comprehensive privacy policy with clear sections
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn} from '@/shared/components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function PolicySection({title, content}: {title: string; content: string}) {
  return (
    <SlideIn>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionContent}>{content}</Text>
      </View>
    </SlideIn>
  );
}

export function PrivacyPolicyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="chevron-left" size="md" color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Politique de Confidentialité</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Hero Section */}
        <FadeIn delay={100}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            style={styles.heroSection}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}>
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <Icon name="lock" size="2xl" color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroTitle}>Protection de vos Données</Text>
              <Text style={styles.heroSubtitle}>
                Découvrez comment nous protégeons votre vie privée
              </Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* Last Updated */}
        <FadeIn delay={200}>
          <View style={styles.lastUpdated}>
            <Text style={styles.lastUpdatedText}>
              Dernière mise à jour: Décembre 2024
            </Text>
          </View>
        </FadeIn>

        {/* Policy Content */}
        <View style={styles.content}>
          <PolicySection
            title="1. Collecte des Données"
            content="Nous collectons uniquement les informations nécessaires au fonctionnement de l'application : vos tickets de caisse scannés, vos préférences d'application et vos informations de compte. Nous ne collectons pas de données sensibles sans votre consentement explicite."
          />

          <PolicySection
            title="2. Utilisation des Données"
            content="Vos données sont utilisées exclusivement pour améliorer votre expérience utilisateur : analyse des prix, suggestions personnalisées, et fonctionnalités de l'application. Nous n'utilisons jamais vos données à des fins commerciales ou de marketing."
          />

          <PolicySection
            title="3. Partage des Données"
            content="Vos données personnelles ne sont jamais vendues, louées ou partagées avec des tiers. Nous pouvons partager des données anonymisées et agrégées uniquement pour améliorer nos services."
          />

          <PolicySection
            title="4. Sécurité des Données"
            content="Toutes vos données sont chiffrées et stockées sur des serveurs sécurisés. Nous utilisons les dernières technologies de sécurité pour protéger vos informations contre tout accès non autorisé."
          />

          <PolicySection
            title="5. Droits des Utilisateurs"
            content="Vous avez le droit d'accéder, modifier ou supprimer vos données à tout moment. Vous pouvez également demander l'exportation de vos données ou la suppression complète de votre compte."
          />

          <PolicySection
            title="6. Cookies et Suivi"
            content="Nous n'utilisons pas de cookies de suivi publicitaire. Les données analytiques sont anonymisées et utilisées uniquement pour améliorer l'application."
          />

          <PolicySection
            title="7. Modifications"
            content="Cette politique peut être mise à jour occasionnellement. Nous vous informerons de tout changement important via l'application ou par email."
          />

          <PolicySection
            title="8. Contact"
            content="Pour toute question concernant cette politique ou vos données, contactez-nous à privacy@goshopperai.com ou via l'application."
          />
        </View>

        {/* Contact Section */}
        <FadeIn delay={1000}>
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Questions sur votre vie privée ?</Text>
            <Text style={styles.contactSubtitle}>
              Notre équipe est là pour vous aider
            </Text>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() =>
                navigation.push('Settings' as any)
              }
              activeOpacity={0.9}>
              <Icon name="message" size="sm" color={Colors.primary} />
              <Text style={styles.contactButtonText}>Contacter le support</Text>
            </TouchableOpacity>
          </View>
        </FadeIn>
      </ScrollView>
    </View>
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
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
    flex: 1,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  heroSection: {
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xl,
  },
  heroContent: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  heroSubtitle: {
    fontSize: Typography.fontSize.md,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  lastUpdated: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  lastUpdatedText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.card.white,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  sectionContent: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  contactSection: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  contactSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  contactButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
});