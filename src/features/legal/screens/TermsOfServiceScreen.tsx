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
              Dernière mise à jour: 17 décembre 2025 - Version 2.0
            </Text>
          </View>
        </FadeIn>

        {/* Terms Content */}
        <View style={styles.content}>
          <TermsSection
            title="1. ACCEPTATION DES CONDITIONS"
            content="En téléchargeant, installant, accédant ou utilisant GoShopper, vous acceptez d'être juridiquement lié par les présentes Conditions Générales d'Utilisation. Ces Conditions constituent un accord juridiquement contraignant. SI VOUS N'ACCEPTEZ PAS CES CONDITIONS DANS LEUR INTÉGRALITÉ, VOUS N'ÊTES PAS AUTORISÉ À UTILISER LE SERVICE."
          />

          <TermsSection
            title="2. DESCRIPTION DU SERVICE"
            content="GoShopper est une application mobile utilisant l'intelligence artificielle qui fournit: Numérisation intelligente (scan et extraction automatique reçus), analyse des dépenses (suivi, catégorisation, analyse achats), gestion budgétaire (outils planification, optimisation), synchronisation multi-appareils, alertes personnalisées, insights IA. Service fourni 'en l'état' et 'selon disponibilité'."
          />

          <TermsSection
            title="3. ADMISSIBILITÉ ET COMPTES"
            content="Conditions d'admissibilité: Âge minimum 13 ans, consentement parental pour 13-18 ans, capacité juridique conclure contrats contraignants, utilisation légale dans votre juridiction. Gestion compte: Informations exactes obligatoires, un compte par personne, responsabilité totale activités sous compte, maintien confidentialité identifiants, notification immédiate utilisation non autorisée."
          />

          <TermsSection
            title="4. UTILISATION ACCEPTABLE"
            content="Usages autorisés: Besoins personnels non commerciaux, scanner vos propres reçus, gérer dépenses personnelles/budgets familiaux. Activités STRICTEMENT interdites: Utilisation frauduleuse (faux reçus, manipulation données), violations techniques (piratage, ingénierie inverse), atteintes sécurité (contournement mesures, malwares), violations droits (propriété intellectuelle, usurpation identité), usage commercial non autorisé, automatisation (robots, scrapers)."
          />

          <TermsSection
            title="5. PROPRIÉTÉ INTELLECTUELLE"
            content="Notre propriété: Application (code source, algorithmes, interface, design), marques (logo GoShopper, noms commerciaux), technologies (IA, OCR, bases données propriétaires). Licence accordée: Limitée, non exclusive, non transférable, révocable pour usage personnel exclusivement. Vos droits: Vous conservez propriété reçus/données personnelles, mais accordez licence traitement pour fournir service."
          />

          <TermsSection
            title="6. PRÉCISION DONNÉES ET RESPONSABILITÉ"
            content="Précision OCR: Technologie IA peut occasionnellement produire erreurs, vérification requise avant utilisation, amélioration continue mais pas garantie 100%. Pas de conseil financier: Service fournit outils analyse/organisation, pas conseils financiers professionnels, toutes décisions financières votre seule responsabilité, consultation conseiller qualifié pour décisions importantes."
          />

          <TermsSection
            title="7. ABONNEMENTS ET PAIEMENTS"
            content="Plans: Gratuit avec fonctionnalités limitées, premium avec fonctionnalités avancées. Facturation: Périodique à l'avance, renouvellement automatique sauf annulation, moyens paiement (cartes, mobile money). Annulation: Via paramètres Application, accès premium continue jusqu'à fin période payée. Remboursements: Régis par politiques app stores. Modifications prix: Préavis 30 jours."
          />

          <TermsSection
            title="8. GARANTIES ET EXCLUSIONS"
            content="DANS MESURE MAXIMALE AUTORISÉE LOI, SERVICE FOURNI 'EN L'ÉTAT' SANS GARANTIES: Qualité marchande/adaptation usage particulier, non-contrefaçon droits propriété intellectuelle, fonctionnement ininterrompu/exempt erreurs, exactitude contenu/données, sécurité complète contre menaces. Risques assumés par utilisateur."
          />

          <TermsSection
            title="9. LIMITATION DE RESPONSABILITÉ"
            content="MESURE MAXIMALE AUTORISÉE LOI, GOSHOPPER PAS RESPONSABLE: Dommages indirects (perte profits, économies, opportunités), dommages consécutifs (interruption activité, perte données, réputation), dommages punitifs/exemplaires, préjudice moral/stress émotionnel. Responsabilité totale ne dépassera jamais montant payé 12 derniers mois. Exceptions: Négligence grave, faute intentionnelle, droits consommateurs impératifs."
          />

          <TermsSection
            title="10. INDEMNISATION"
            content="Vous acceptez indemniser, défendre et dégager responsabilité GoShopper contre réclamations découlant de: Utilisation Service violation Conditions, violation droits tiers, négligence/faute intentionnelle, contenu soumis via Service. Protection maximale société contre risques utilisateur malveillant ou négligent."
          />

          <TermsSection
            title="11. RÉSILIATION"
            content="Résiliation utilisateur: Suppression Application appareils, contact support client, fonctions suppression compte Application. Résiliation société: Immédiate avec/sans motif, violation Conditions, cessation service, inactivité prolongée, protection intérêts. Effets résiliation: Droit utilisation cesse immédiatement, suppression compte/données possible, clauses survivent, aucun remboursement (sauf exceptions légales)."
          />

          <TermsSection
            title="12. FORCE MAJEURE"
            content="Pas responsables retard/défaut exécution circonstances indépendantes volonté raisonnable: Catastrophes naturelles, guerres, terrorisme, grèves, conflits sociaux, défaillances infrastructure internet/électrique, actions gouvernementales, changements réglementaires, pandemies, urgences sanitaires publiques. Suspension obligations pendant durée empêchement."
          />

          <TermsSection
            title="13. JURIDICTION ET LOI APPLICABLE"
            content="Droit applicable: Conditions régies lois françaises sans égard principes conflit lois. Compétence: Tribunaux français compétence exclusive, sous réserve droits impératifs consommateurs. Résolution alternative: Négociation directe encouragée, médiation tiers neutre, arbitrage si convenu mutuellement. Procédures amiables avant action judiciaire."
          />

          <TermsSection
            title="14. CONFORMITÉ RÉGLEMENTAIRE"
            content="Service développé conformité: Réglementation européenne protection données (RGPD), lois françaises informatique et libertés, réglementations app stores (Apple, Google), standards sécurité industrie. Adaptation continue évolutions réglementaires pour maintenir conformité maximale."
          />

          <TermsSection
            title="15. DISPOSITIONS GÉNÉRALES"
            content="Intégralité accord: Conditions + Politique Confidentialité constituent accord complet. Divisibilité: Si disposition invalide, autres restent vigueur. Renonciation: Défaut exercice droit pas renonciation. Cession: Vous pas céder droits sans consentement écrit, nous pouvons céder sans restriction. Pas partenariat/joint-venture/emploi/agence créé."
          />

          <TermsSection
            title="16. CONTACT ET SUPPORT"
            content="Communications officielles: support@goshopper.app (technique 48h), legal@goshopper.app (légal 5j), privacy@goshopper.app (données 30j RGPD), https://goshopper.app (site web). Délais réponse garantis pour protection utilisateurs et conformité réglementaire."
          />

          <TermsSection
            title="17. ACCEPTATION FINALE"
            content="EN UTILISANT SERVICE GOSHOPPER, VOUS RECONNAISSEZ AVOIR LU, COMPRIS ET ACCEPTÉ CES CONDITIONS GÉNÉRALES D'UTILISATION DANS LEUR INTÉGRALITÉ. Accord juridiquement contraignant en vigueur. Utilisation continue constitue acceptation renouvelée."
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