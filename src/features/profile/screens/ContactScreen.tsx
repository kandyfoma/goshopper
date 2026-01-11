// Contact Screen - Support Contact Form
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useUser} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Header, Button, Toast} from '@/shared/components';
import {analyticsService} from '@/shared/services/analytics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Contact Categories
const CONTACT_CATEGORIES = [
  {id: 'bug', label: 'Signaler un bug', icon: 'alert-circle'},
  {id: 'feature', label: 'Suggestion de fonctionnalité', icon: 'lightbulb'},
  {id: 'account', label: 'Problème de compte', icon: 'user'},
  {id: 'billing', label: 'Question de facturation', icon: 'credit-card'},
  {id: 'other', label: 'Autre', icon: 'help-circle'},
];

interface ContactFormData {
  category: string;
  subject: string;
  message: string;
}

export function ContactScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuth();
  const {profile} = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  const [formData, setFormData] = useState<ContactFormData>({
    category: '',
    subject: '',
    message: '',
  });

  const validateForm = () => {
    if (!formData.category) {
      showToastMessage('Veuillez sélectionner une catégorie', 'error');
      return false;
    }
    if (!formData.subject.trim()) {
      showToastMessage('Veuillez saisir un objet', 'error');
      return false;
    }
    if (!formData.message.trim()) {
      showToastMessage('Veuillez saisir votre message', 'error');
      return false;
    }
    return true;
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      // Here you would typically send the data to your backend
      // For now, we'll simulate the submission
      await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
      
      analyticsService.logCustomEvent('contact_form_submitted', {
        category: formData.category,
        user_id: user?.uid,
      });
      
      showToastMessage('Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.', 'success');
      
      // Reset form
      setFormData({
        category: '',
        subject: '',
        message: '',
      });
      
      // Navigate back after a delay
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
      
    } catch (error) {
      console.error('Contact form error:', error);
      showToastMessage('Erreur lors de l\'envoi du message. Veuillez réessayer.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const CategorySelector = () => (
    <View style={styles.categoryContainer}>
      <Text style={styles.label}>Catégorie *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {CONTACT_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryItem,
              formData.category === category.id && styles.categoryItemSelected
            ]}
            onPress={() => setFormData({...formData, category: category.id})}>
            <Icon
              name={category.icon}
              size="sm"
              color={formData.category === category.id ? Colors.white : Colors.text.secondary}
            />
            <Text style={[
              styles.categoryText,
              formData.category === category.id && styles.categoryTextSelected
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Nous contacter"
        leftIcon="chevron-left"
        onLeftPress={() => navigation.goBack()}
      />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User Info */}
          <View style={styles.userInfo}>
            <Icon name="user" size="md" color={Colors.primary} />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{profile?.displayName || user?.email}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>

          {/* Contact Form */}
          <View style={styles.form}>
            <CategorySelector />
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Objet *</Text>
              <TextInput
                style={styles.input}
                placeholder="Résumé de votre demande"
                value={formData.subject}
                onChangeText={(text) => setFormData({...formData, subject: text})}
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Message *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Décrivez votre problème ou question en détail..."
                value={formData.message}
                onChangeText={(text) => setFormData({...formData, message: text})}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>
            
            <Button
              title={isSubmitting ? 'Envoi en cours...' : 'Envoyer le message'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.submitButton}
            />
          </View>

          {/* Contact Info */}
          <View style={styles.contactInfo}>
            <Text style={styles.contactInfoTitle}>Autres moyens de nous contacter</Text>
            <View style={styles.contactMethod}>
              <Icon name="mail" size="sm" color={Colors.text.secondary} />
              <Text style={styles.contactMethodText}>support@goshopperai.com</Text>
            </View>
            <Text style={styles.responseTime}>
              Nous répondons généralement dans les 24 heures
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  userDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  userName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  userEmail: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  form: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  categoryContainer: {
    marginBottom: Spacing.lg,
  },
  categoryScroll: {
    marginTop: Spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary,
    gap: Spacing.xs,
  },
  categoryItemSelected: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },
  categoryTextSelected: {
    color: Colors.white,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text.primary,
    backgroundColor: Colors.white,
  },
  textArea: {
    minHeight: 120,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
  contactInfo: {
    backgroundColor: Colors.background.secondary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  contactInfoTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  contactMethodText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  responseTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
});