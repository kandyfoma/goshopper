// Terms of Service Screen - Display Terms and Conditions
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
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
import {Header} from '@/shared/components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function TermsScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Conditions d'utilisation"
        leftIcon="chevron-left"
        onLeftPress={() => navigation.goBack()}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Conditions d'utilisation</Text>
          <Text style={styles.version}>Version 2.0</Text>
          <Text style={styles.date}>Dernière mise à jour : 17 décembre 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptation des conditions</Text>
          <Text style={styles.text}>
            En utilisant GoShopperAI, vous acceptez d'être lié par ces conditions d'utilisation. 
            Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description du service</Text>
          <Text style={styles.text}>
            GoShopperAI est une application mobile qui utilise l'intelligence artificielle pour 
            analyser vos reçus d'achat, suivre vos dépenses et vous fournir des informations 
            sur vos habitudes de consommation.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Utilisation acceptable</Text>
          <Text style={styles.text}>
            Vous vous engagez à utiliser l'application uniquement à des fins légales et conformément 
            à ces conditions. Vous ne devez pas :
          </Text>
          <Text style={styles.bulletText}>• Utiliser l'application à des fins illégales</Text>
          <Text style={styles.bulletText}>• Tenter de contourner les mesures de sécurité</Text>
          <Text style={styles.bulletText}>• Transmettre des virus ou codes malveillants</Text>
          <Text style={styles.bulletText}>• Violer les droits de propriété intellectuelle</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Propriété intellectuelle</Text>
          <Text style={styles.text}>
            Tous les contenus, marques, logos et propriété intellectuelle dans l'application 
            sont la propriété de GoShopperAI ou de ses concédants de licence. Vous ne pouvez 
            pas reproduire, distribuer ou créer des œuvres dérivées sans autorisation.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Confidentialité et données</Text>
          <Text style={styles.text}>
            Votre confidentialité est importante pour nous. Veuillez consulter notre Politique 
            de Confidentialité pour comprendre comment nous collectons, utilisons et protégeons 
            vos informations personnelles.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Limitation de responsabilité</Text>
          <Text style={styles.text}>
            GoShopperAI est fourni "en l'état" sans garanties. Nous ne sommes pas responsables 
            des dommages directs, indirects, accessoires ou consécutifs résultant de l'utilisation 
            de l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Modifications</Text>
          <Text style={styles.text}>
            Nous nous réservons le droit de modifier ces conditions à tout moment. Les 
            modifications entreront en vigueur dès leur publication dans l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Contact</Text>
          <Text style={styles.text}>
            Pour toute question concernant ces conditions d'utilisation, veuillez nous 
            contacter via l'option "Nous contacter" dans l'application.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            En continuant à utiliser GoShopperAI, vous confirmez que vous avez lu, 
            compris et accepté ces conditions d'utilisation.
          </Text>
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
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  version: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
    backgroundColor: Colors.card.red,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  date: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    paddingLeft: Spacing.md,
  },
  text: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    lineHeight: Typography.fontSize.md * 1.6,
    textAlign: 'justify',
  },
  bulletText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    lineHeight: Typography.fontSize.md * 1.6,
    marginTop: Spacing.xs,
    marginLeft: Spacing.md,
  },
  footer: {
    backgroundColor: Colors.card.cream,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  footerText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.5,
  },
});