// AI Assistant Screen - Natural language queries about spending
import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {useAuth} from '@/shared/contexts';
import {
  naturalLanguageService,
  QueryResult,
  ConversationMessage,
} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme';
import {Icon, Spinner} from '@/shared/components';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export function AIAssistantScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(
    naturalLanguageService.getSuggestedQueries(),
  );
  const flatListRef = useRef<FlatList>(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Load conversation history
  useEffect(() => {
    const history = naturalLanguageService.getConversationHistory();
    setMessages(history);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !user?.uid || isLoading) return;

    const query = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Add user message immediately
    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await naturalLanguageService.processQuery(
        user.uid,
        query,
        true,
      );

      // Add assistant response
      const assistantMessage: ConversationMessage = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: result.answer,
        contentLingala: result.answerLingala,
        timestamp: new Date(),
        data: result,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update suggestions based on response
      if (result.suggestions) {
        setSuggestions(result.suggestions.map(s => ({fr: s, lingala: ''})));
      }
    } catch (error) {
      console.error('Query error:', error);

      const errorMessage: ConversationMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: "Désolé, je n'ai pas pu traiter votre demande. Réessayez.",
        contentLingala: 'Limbisa, nakoki te. Meka lisusu.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
  };

  const handleClearHistory = () => {
    naturalLanguageService.clearHistory();
    setMessages([]);
    setSuggestions(naturalLanguageService.getSuggestedQueries());
  };

  const renderMessage = ({item}: {item: ConversationMessage}) => {
    const isUser = item.role === 'user';
    const queryResult = item.data as QueryResult | undefined;

    return (
      <Animated.View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {opacity: fadeAnim},
        ]}>
        {!isUser && (
          <View style={styles.assistantAvatar}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.avatarGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <Icon name="bot" size="sm" color={Colors.white} />
            </LinearGradient>
          </View>
        )}

        <View
          style={[
            styles.messageContent,
            isUser ? styles.userContent : styles.assistantContent,
          ]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>
            {item.content}
          </Text>

          {item.contentLingala && !isUser && (
            <Text style={styles.lingalaText}>{item.contentLingala}</Text>
          )}

          {/* Chart data preview */}
          {queryResult?.chartData && (
            <View style={styles.chartPreview}>
              <View style={styles.chartTitleRow}>
                <Icon name="bar-chart-2" size="sm" color={Colors.primary} />
                <Text style={styles.chartTitle}>
                  {queryResult.chartData.datasets[0]?.label || 'Données'}
                </Text>
              </View>
              {queryResult.chartData.labels.slice(0, 3).map((label, index) => (
                <View key={index} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{label}</Text>
                  <Text style={styles.chartValue}>
                    $
                    {queryResult.chartData!.datasets[0].data[index]?.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Suggestions from response */}
          {queryResult?.suggestions && queryResult.suggestions.length > 0 && (
            <View style={styles.inlineSuggestions}>
              {queryResult.suggestions.slice(0, 2).map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.inlineSuggestionChip}
                  onPress={() => handleSuggestionPress(suggestion)}
                  activeOpacity={0.7}>
                  <Text style={styles.inlineSuggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {isUser && (
          <View style={styles.userAvatar}>
            <Icon name="user" size="sm" color={Colors.text.secondary} />
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="chevron-left" size="md" color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Assistant IA</Text>
          <Text style={styles.headerSubtitle}>Posez vos questions</Text>
        </View>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearHistory}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="trash-2" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        {/* Messages */}
        {messages.length === 0 ? (
          <Animated.View
            style={[
              styles.welcomeContainer,
              {
                opacity: fadeAnim,
                transform: [{translateY: slideAnim}],
              },
            ]}>
            <View style={styles.welcomeIconContainer}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.welcomeIconGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon name="bot" size="xl" color={Colors.white} />
              </LinearGradient>
            </View>
            <Text style={styles.welcomeTitle}>Bonjour!</Text>
            <Text style={styles.welcomeText}>
              Posez-moi des questions sur vos dépenses, vos factures, ou les
              prix.
            </Text>

            {/* Initial Suggestions */}
            <View style={styles.welcomeSuggestions}>
              <Text style={styles.suggestionsTitle}>Essayez:</Text>
              {suggestions.slice(0, 4).map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.welcomeSuggestionButton}
                  onPress={() => handleSuggestionPress(suggestion.fr)}
                  activeOpacity={0.8}>
                  <View style={styles.suggestionIconContainer}>
                    <Icon name="message-circle" size="sm" color={Colors.primary} />
                  </View>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={styles.welcomeSuggestionText}>
                      {suggestion.fr}
                    </Text>
                    {suggestion.lingala && (
                      <Text style={styles.welcomeSuggestionLingala}>
                        {suggestion.lingala}
                      </Text>
                    )}
                  </View>
                  <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />
        )}

        {/* Quick Suggestions Bar */}
        {messages.length > 0 && suggestions.length > 0 && (
          <View style={styles.suggestionsBar}>
            <FlatList
              horizontal
              data={suggestions.slice(0, 5)}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() =>
                    handleSuggestionPress(
                      typeof item === 'string' ? item : item.fr,
                    )
                  }
                  activeOpacity={0.7}>
                  <Text style={styles.suggestionChipText}>
                    {typeof item === 'string' ? item : item.fr}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item, index) => index.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            />
          </View>
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, {paddingBottom: insets.bottom + Spacing.sm}]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Tapez votre question..."
              placeholderTextColor={Colors.text.tertiary}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.9}>
            {isLoading ? (
              <Spinner size="small" color={Colors.white} />
            ) : (
              <LinearGradient
                colors={inputText.trim() ? [Colors.primary, Colors.primaryDark] : [Colors.border, Colors.border]}
                style={styles.sendButtonGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon name="send" size="sm" color={Colors.white} />
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  welcomeIconContainer: {
    marginBottom: Spacing.lg,
  },
  welcomeIconGradient: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: Typography.fontSize.xxxl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  welcomeText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  welcomeSuggestions: {
    width: '100%',
  },
  suggestionsTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  welcomeSuggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  suggestionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  welcomeSuggestionText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  welcomeSuggestionLingala: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  messagesList: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  assistantBubble: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    marginRight: Spacing.sm,
  },
  avatarGradient: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  messageContent: {
    maxWidth: '75%',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  userContent: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: BorderRadius.sm,
  },
  assistantContent: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: BorderRadius.sm,
    ...Shadows.sm,
  },
  messageText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 22,
    color: Colors.text.primary,
  },
  userText: {
    color: Colors.white,
  },
  lingalaText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chartPreview: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.lg,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  chartTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  chartLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },
  chartValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
  inlineSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  inlineSuggestionChip: {
    backgroundColor: Colors.card.green,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  inlineSuggestionText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },
  suggestionsBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  suggestionsScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionChip: {
    backgroundColor: Colors.card.blue,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  suggestionChipText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
  },
  textInput: {
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
