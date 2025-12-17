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
              Dernière mise à jour: 17 décembre 2025 - Version 2.0
            </Text>
          </View>
        </FadeIn>

        {/* Policy Content */}
        <View style={styles.content}>
          <PolicySection
            title="1. INTRODUCTION"
            content="GoShopper exploite l'application mobile GoShopper. Cette politique de confidentialité vous informe de nos pratiques concernant la collecte, l'utilisation, la divulgation et la protection de vos informations personnelles. EN UTILISANT NOTRE SERVICE, VOUS CONSENTEZ À LA COLLECTE, L'UTILISATION ET LA DIVULGATION DE VOS INFORMATIONS CONFORMÉMENT À CETTE POLITIQUE."
          />

          <PolicySection
            title="2. INFORMATIONS COLLECTÉES"
            content="Informations Fournies: Informations de compte (e-mail, nom, photo), données de reçus (images scannées, noms de magasins, produits, prix), listes d'achats, préférences, communications support. Informations Automatiques: Informations d'appareil, données d'utilisation, localisation approximative (avec permission), données analytiques, métadonnées techniques."
          />

          <PolicySection
            title="3. UTILISATION DES INFORMATIONS"
            content="Vos données sont utilisées exclusivement pour: Fonctionnalité de base (traitement reçus, suivi prix, insights dépenses), authentification et sécurité (gestion comptes, prévention fraude), personnalisation (expérience utilisateur, recommandations), amélioration du service (développement technique, OCR, bugs), support client (assistance technique)."
          />

          <PolicySection
            title="4. BASE LÉGALE DU TRAITEMENT (RGPD)"
            content="Nous traitons vos données sur la base de: Exécution du contrat (fourniture du service), intérêts légitimes (amélioration service, sécurité), consentement (marketing, géolocalisation), obligation légale (conformité lois). Cette politique respecte le RGPD, CCPA, COPPA et autres réglementations."
          />

          <PolicySection
            title="5. PARTAGE ET DIVULGATION"
            content="Nous NE partageons JAMAIS: Vos informations personnelles à des fins commerciales, vos données de reçus avec des tiers non autorisés, vos informations avec des annonceurs. Partage autorisé uniquement: Prestataires de services (Firebase, OAuth) sous accords stricts, obligations légales, protection sécurité, consentement explicite."
          />

          <PolicySection
            title="6. SÉCURITÉ ET PROTECTION"
            content="Mesures techniques: Chiffrement AES-256 transit/repos, OAuth 2.0, contrôles d'accès basés rôles, surveillance continue activités suspectes. Mesures organisationnelles: Formation personnel sécurité données, politiques internes strictes, évaluations risques périodiques. Traitement local OCR lorsque possible."
          />

          <PolicySection
            title="7. VOS DROITS ET CONTRÔLES"
            content="Droits d'accès et contrôle: Accès (copie complète données), rectification (correction informations), suppression (droit à l'oubli), portabilité (export format structuré), opposition (traitement spécifique), retrait consentement. Contactez privacy@goshopper.app avec demande spécifique et preuve d'identité. Délai réponse: 30 jours maximum."
          />

          <PolicySection
            title="8. CONSERVATION DES DONNÉES"
            content="Durées de conservation: Données compte (tant que compte actif), images reçus (jusqu'à suppression manuelle/fermeture), données usage (24 mois max), journaux sécurité (12 mois). Suppression automatique: Données supprimées définitivement effacées dans 30 jours. Aucune récupération possible après suppression confirmée."
          />

          <PolicySection
            title="9. CONFIDENTIALITÉ DES MINEURS"
            content="Service non destiné enfants moins 13 ans. Vérification âge lors inscription. Suppression immédiate données si utilisation mineur détectée. Consentement parental requis utilisateurs 13-16 ans selon juridiction. Procédures vérification consentement parental mises en place."
          />

          <PolicySection
            title="10. CONFORMITÉ RÉGLEMENTAIRE"
            content="Cette politique respecte: RGPD (Union Européenne), CCPA (Californie), COPPA (États-Unis), Loi Informatique et Libertés (France), autres réglementations locales. Représentant UE: eu-representative@goshopper.app. Transferts internationaux avec clauses contractuelles types pour pays tiers."
          />

          <PolicySection
            title="11. VIOLATIONS DE DONNÉES"
            content="En cas violation données personnelles: Notification autorités compétentes dans 72h, information utilisateurs affectés si risque élevé, mesures correctives immédiates. Procédures incident établies pour réponse rapide et efficace."
          />

          <PolicySection
            title="12. MODIFICATIONS POLITIQUE"
            content="Notification changements: Via application (modifications importantes), e-mail notification utilisateurs enregistrés, publication nouvelle version site web, préavis 30 jours changements substantiels. Utilisation continue service après modifications constitue acceptation politique révisée."
          />

          <PolicySection
            title="13. CONTACT ET RÉCLAMATIONS"
            content="Contacts: privacy@goshopper.app (confidentialité), support@goshopper.app (support général), dpo@goshopper.app (délégué protection données). Réclamations: Droit dépôt plainte autorité supervision compétente. France: CNIL. UE: Autorité protection données pays résidence. Site web: https://goshopper.app/privacy"
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