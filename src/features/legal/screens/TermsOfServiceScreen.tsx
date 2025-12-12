// Terms of Service Screen - Urbanist Design System
// Comprehensive terms and conditions with clear sections
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

function TermsSection({title, content}: {title: string; content: string}) {
  return (
    <SlideIn>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionContent}>{content}</Text>
      </View>
    </SlideIn>
  );
}

export function TermsOfServiceScreen() {
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
        <Text style={styles.headerTitle}>Conditions d'Utilisation</Text>
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
              <Icon name="document" size="2xl" color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroTitle}>Conditions d'Utilisation</Text>
              <Text style={styles.heroSubtitle}>
                Découvrez les règles d'utilisation de l'application
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

        {/* Terms Content */}
        <View style={styles.content}>
          <TermsSection
            title="1. Acceptation des Conditions"
            content="En utilisant GoShopperAI, vous acceptez d'être lié par ces conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application."
          />

          <TermsSection
            title="2. Description du Service"
            content="GoShopperAI est une application mobile qui permet de scanner des tickets de caisse, suivre les prix des articles, et recevoir des alertes personnalisées. Le service est fourni 'en l'état' sans garanties expresses ou implicites."
          />

          <TermsSection
            title="3. Utilisation Acceptable"
            content="Vous vous engagez à utiliser l'application uniquement pour des fins légales et conformément à ces conditions. Il est interdit d'utiliser l'application pour des activités frauduleuses, illégales ou nuisibles."
          />

          <TermsSection
            title="4. Comptes Utilisateur"
            content="Pour utiliser certaines fonctionnalités, vous devez créer un compte. Vous êtes responsable de maintenir la confidentialité de vos identifiants et de toutes les activités qui se produisent sous votre compte."
          />

          <TermsSection
            title="5. Propriété Intellectuelle"
            content="L'application et son contenu sont protégés par les droits d'auteur et autres lois sur la propriété intellectuelle. Vous ne pouvez pas copier, modifier ou distribuer le contenu sans autorisation préalable."
          />

          <TermsSection
            title="6. Données et Confidentialité"
            content="Vos données sont collectées et traitées conformément à notre politique de confidentialité. En utilisant l'application, vous consentez à cette collecte et traitement."
          />

          <TermsSection
            title="7. Limitation de Responsabilité"
            content="GoShopperAI ne peut être tenu responsable des dommages directs, indirects, spéciaux ou consécutifs découlant de l'utilisation de l'application. L'utilisation se fait à vos propres risques."
          />

          <TermsSection
            title="8. Résiliation"
            content="Nous nous réservons le droit de suspendre ou résilier votre compte à tout moment pour violation de ces conditions. Vous pouvez également résilier votre compte à tout moment."
          />

          <TermsSection
            title="9. Modifications"
            content="Ces conditions peuvent être modifiées à tout moment. Nous vous informerons des changements importants. L'utilisation continue de l'application constitue l'acceptation des nouvelles conditions."
          />

          <TermsSection
            title="10. Droit Applicable"
            content="Ces conditions sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux français."
          />

          <TermsSection
            title="11. Contact"
            content="Pour toute question concernant ces conditions, contactez-nous à legal@goshopperai.com ou via l'application."
          />
        </View>

        {/* Contact Section */}
        <FadeIn delay={1200}>
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Questions sur les conditions ?</Text>
            <Text style={styles.contactSubtitle}>
              Notre équipe juridique est là pour vous aider
            </Text>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() =>
                navigation.navigate('Settings' as any)
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