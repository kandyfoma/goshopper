// FAQ Screen - Urbanist Design System
// Comprehensive FAQ with collapsible sections
import React, {useState} from 'react';
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

interface FAQItemProps {
  question: string;
  answer: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function FAQItem({question, answer, isExpanded, onToggle}: FAQItemProps) {
  return (
    <SlideIn>
      <TouchableOpacity
        style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
        onPress={onToggle}
        activeOpacity={0.9}>
        <View style={styles.faqHeader}>
          <Text style={styles.faqQuestion}>{question}</Text>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size="sm"
            color={Colors.text.secondary}
          />
        </View>
        {isExpanded && (
          <FadeIn delay={100}>
            <Text style={styles.faqAnswer}>{answer}</Text>
          </FadeIn>
        )}
      </TouchableOpacity>
    </SlideIn>
  );
}

export function FAQScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const faqData = [
    {
      question: 'Comment scanner un ticket de caisse ?',
      answer: 'Ouvrez l\'app et allez dans l\'onglet Scanner. Prenez une photo claire de votre ticket de caisse. L\'app analysera automatiquement les articles et les prix.',
    },
    {
      question: 'Puis-je modifier les informations scannées ?',
      answer: 'Oui, après le scan, vous pouvez modifier les noms d\'articles, les prix et les quantités directement dans l\'app.',
    },
    {
      question: 'Comment créer des alertes de prix ?',
      answer: 'Allez dans Paramètres > Alertes de prix. Vous pouvez définir des seuils de prix pour vos articles préférés.',
    },
    {
      question: 'Mes données sont-elles sécurisées ?',
      answer: 'Oui, toutes vos données sont chiffrées et stockées de manière sécurisée. Nous ne partageons jamais vos informations personnelles.',
    },
    {
      question: 'Comment contacter le support ?',
      answer: 'Vous pouvez nous contacter via l\'onglet Support dans les paramètres ou par email à support@goshopperai.com.',
    },
    {
      question: 'L\'app est-elle gratuite ?',
      answer: 'L\'app propose un essai gratuit avec un nombre limité de scans. Pour accéder à toutes les fonctionnalités, choisissez un abonnement Premium.',
    },
    {
      question: 'Puis-je exporter mes données ?',
      answer: 'Oui, vous pouvez exporter vos listes d\'achats et l\'historique de vos achats au format PDF ou CSV.',
    },
    {
      question: 'Comment fonctionne l\'assistant IA ?',
      answer: 'L\'assistant IA vous aide à optimiser vos achats en analysant vos habitudes de consommation et en vous suggérant des alternatives.',
    },
  ];

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
        <Text style={styles.headerTitle}>FAQ</Text>
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
              <Icon name="help" size="2xl" color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroTitle}>Questions Fréquentes</Text>
              <Text style={styles.heroSubtitle}>
                Trouvez rapidement des réponses à vos questions
              </Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* FAQ Items */}
        <View style={styles.faqContainer}>
          {faqData.map((item, index) => (
            <FAQItem
              key={index}
              question={item.question}
              answer={item.answer}
              isExpanded={expandedItems.has(index)}
              onToggle={() => toggleItem(index)}
            />
          ))}
        </View>

        {/* Contact Section */}
        <FadeIn delay={800}>
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Vous n'avez pas trouvé votre réponse ?</Text>
            <Text style={styles.contactSubtitle}>
              Notre équipe de support est là pour vous aider
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
  faqContainer: {
    paddingHorizontal: Spacing.lg,
  },
  faqItem: {
    backgroundColor: Colors.card.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  faqItemExpanded: {
    ...Shadows.md,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.md,
  },
  faqAnswer: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
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