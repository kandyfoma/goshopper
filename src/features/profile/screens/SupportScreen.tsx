// Support Screen - Help Center with FAQ and Contact Options
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Header} from '@/shared/components';
import {analyticsService} from '@/shared/services/analytics';

const {width} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// FAQ Data
const FAQ_DATA = [
  {
    id: '1',
    category: 'Général',
    question: 'Comment GoShopperAI fonctionne-t-il ?',
    answer: 'GoShopperAI utilise l\'intelligence artificielle pour analyser vos reçus et vous aider à suivre vos dépenses. Scannez simplement vos reçus avec l\'appareil photo et l\'application extraira automatiquement les informations importantes.'
  },
  {
    id: '2',
    category: 'Scanner',
    question: 'Mes reçus ne sont pas reconnus correctement',
    answer: 'Assurez-vous que le reçu est bien éclairé et que le texte est lisible. Tenez votre téléphone stable et parallèle au reçu. Si le problème persiste, vous pouvez saisir manuellement les informations.'
  },
  {
    id: '3',
    category: 'Compte',
    question: 'Comment modifier mes informations personnelles ?',
    answer: 'Allez dans l\'onglet Profil, puis appuyez sur "Modifier le profil" pour mettre à jour vos informations personnelles comme votre nom, email et ville par défaut.'
  },
  {
    id: '4',
    category: 'Budget',
    question: 'Comment définir mon budget mensuel ?',
    answer: 'Dans l\'onglet Profil, appuyez sur "Paramètres du Budget" pour définir votre budget mensuel et vos catégories de dépenses. L\'application vous aidera à suivre vos dépenses par rapport à ce budget.'
  },
  {
    id: '5',
    category: 'Données',
    question: 'Mes données sont-elles sécurisées ?',
    answer: 'Oui, nous utilisons un chiffrement de bout en bout pour protéger vos données. Toutes les informations sont stockées de manière sécurisée et ne sont jamais partagées avec des tiers sans votre consentement.'
  },
  {
    id: '6',
    category: 'Abonnement',
    question: 'Quels sont les avantages de l\'abonnement premium ?',
    answer: 'L\'abonnement premium vous donne accès à des analyses avancées, un stockage illimité de reçus, des rapports détaillés et un support prioritaire.'
  }
];

// Support Category Card
const SupportCategoryCard = ({
  icon,
  title,
  description,
  onPress,
  color = 'blue',
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  color?: 'red' | 'crimson' | 'blue' | 'cosmos' | 'cream' | 'yellow';
}) => {
  const cardColors = {
    red: Colors.card.red,
    crimson: Colors.card.crimson,
    blue: Colors.card.blue,
    cosmos: Colors.card.cosmos,
    cream: Colors.card.cream,
    yellow: Colors.card.yellow,
  };

  return (
    <TouchableOpacity style={[styles.categoryCard, {backgroundColor: cardColors[color]}]} onPress={onPress}>
      <View style={styles.categoryIcon}>
        <Icon name={icon} size="md" color={Colors.primary} />
      </View>
      <View style={styles.categoryContent}>
        <Text style={styles.categoryTitle}>{title}</Text>
        <Text style={styles.categoryDescription}>{description}</Text>
      </View>
      <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
    </TouchableOpacity>
  );
};

// FAQ Item
const FAQItem = ({item}: {item: typeof FAQ_DATA[0]}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => setExpanded(!expanded)}>
        <Text style={styles.faqQuestionText}>{item.question}</Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size="sm"
          color={Colors.text.secondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
};

export function SupportScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');

  const categories = ['Tous', 'Général', 'Scanner', 'Compte', 'Budget', 'Données', 'Abonnement'];
  
  const filteredFAQ = selectedCategory === 'Tous' 
    ? FAQ_DATA 
    : FAQ_DATA.filter(item => item.category === selectedCategory);

  const handleContactPress = () => {
    analyticsService.logCustomEvent('contact_support_pressed');
    navigation.push('Contact');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Aide et Support"
        leftIcon="chevron-left"
        onLeftPress={() => navigation.goBack()}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Help Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comment pouvons-nous vous aider ?</Text>
          
          <SupportCategoryCard
            icon="message-circle"
            title="Nous contacter"
            description="Envoyez-nous un message pour une assistance personnalisée"
            onPress={handleContactPress}
            color="crimson"
          />
          
          <SupportCategoryCard
            icon="book"
            title="Guide d'utilisation"
            description="Apprenez à utiliser toutes les fonctionnalités de l'app"
            onPress={() => {}}
            color="blue"
          />
          
          <SupportCategoryCard
            icon="settings"
            title="Résolution de problèmes"
            description="Solutions aux problèmes les plus courants"
            onPress={() => {}}
            color="cosmos"
          />
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions Fréquentes</Text>
          
          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryTab,
                  selectedCategory === category && styles.categoryTabActive
                ]}
                onPress={() => setSelectedCategory(category)}>
                <Text style={[
                  styles.categoryTabText,
                  selectedCategory === category && styles.categoryTabTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* FAQ Items */}
          <View style={styles.faqList}>
            {filteredFAQ.map((item) => (
              <FAQItem key={item.id} item={item} />
            ))}
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Besoin d'aide supplémentaire ?</Text>
          <TouchableOpacity style={styles.contactButton} onPress={handleContactPress}>
            <Icon name="mail" size="sm" color={Colors.white} />
            <Text style={styles.contactButtonText}>Nous contacter</Text>
          </TouchableOpacity>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    ...Shadows.sm,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  categoryDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  categoryFilter: {
    marginBottom: Spacing.lg,
  },
  categoryTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary,
  },
  categoryTabActive: {
    backgroundColor: Colors.primary,
  },
  categoryTabText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },
  categoryTabTextActive: {
    color: Colors.white,
  },
  faqList: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginRight: Spacing.sm,
  },
  faqAnswer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: 0,
  },
  faqAnswerText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  contactButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
});