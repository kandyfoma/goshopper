// AI Assistant Screen - Natural language queries about spending
import React, {useState, useRef, useEffect, useCallback} from 'react';
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
  Share,
  Alert,
  Vibration,
  Keyboard,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Voice, {SpeechResultsEvent, SpeechErrorEvent} from '@react-native-voice/voice';
import Clipboard from '@react-native-clipboard/clipboard';
import {RootStackParamList} from '@/shared/types';
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
} from '@/shared/theme/theme';
import {Icon, Spinner} from '@/shared/components';
import {useToast} from '@/shared/contexts/ToastContext';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export function AIAssistantScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [suggestions, setSuggestions] = useState(
    naturalLanguageService.getSuggestedQueries(),
  );
  const {showToast} = useToast();

  // Typing indicator animation
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Keyboard handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
        // Scroll to bottom when keyboard appears
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Load conversation history and add welcome message if empty
  useEffect(() => {
    const history = naturalLanguageService.getConversationHistory();
    if (history.length === 0) {
      // Add welcome message for new conversations
      const welcomeMessage: ConversationMessage = {
        id: 'welcome_msg',
        role: 'assistant',
        content: "Bonjour ! Je suis votre assistant financier personnel. Je peux vous aider à comprendre vos dépenses, trouver les meilleurs prix, et vous donner des conseils d'économie. Que souhaitez-vous savoir ?",
        contentLingala: "Mbote! Nazali assistant financier na yo. Nakoki kosunga yo na koyeba mbongo na yo, kozwa ntalo ya malamu, mpe kopesa yo likebisi ya kobikisa mbongo. Nini olingi koyeba?",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    } else {
      setMessages(history);
    }
  }, []);

  // Voice recognition setup
  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (e.value && e.value[0]) {
        setInputText(prev => prev + (prev ? ' ' : '') + e.value![0]);
      }
    };
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      console.error('Voice error:', e);
      setIsListening(false);
      showToast('error', 'Erreur de reconnaissance vocale');
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [showToast]);

  // Typing indicator animation
  useEffect(() => {
    if (isLoading) {
      const createBounce = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: -8,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = createBounce(typingDot1, 0);
      const anim2 = createBounce(typingDot2, 150);
      const anim3 = createBounce(typingDot3, 300);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        typingDot1.setValue(0);
        typingDot2.setValue(0);
        typingDot3.setValue(0);
      };
    }
  }, [isLoading, typingDot1, typingDot2, typingDot3]);

  // Voice input handlers
  const startListening = useCallback(async () => {
    try {
      await Voice.start('fr-FR');
      Vibration.vibrate(50);
    } catch (e) {
      console.error('Voice start error:', e);
      showToast('error', 'Impossible de démarrer la reconnaissance vocale');
    }
  }, [showToast]);

  const stopListening = useCallback(async () => {
    try {
      await Voice.stop();
    } catch (e) {
      console.error('Voice stop error:', e);
    }
  }, []);

  // Copy message to clipboard
  const handleCopyMessage = useCallback((content: string) => {
    Clipboard.setString(content);
    showToast('success', 'Message copié');
    setSelectedMessageId(null);
  }, [showToast]);

  // Share message
  const handleShareMessage = useCallback(async (content: string) => {
    try {
      await Share.share({
        message: content,
        title: 'GoShopper Assistant',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
    setSelectedMessageId(null);
  }, []);

  // Format timestamp
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !user?.uid || isLoading) {return;}

    // Haptic feedback on send
    Vibration.vibrate(30);

    const query = inputText.trim();
    setInputText('');
    setIsLoading(true);
    setIsThinking(true);

    // Add user message immediately with better UX
    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Scroll to bottom after adding user message
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const result = await naturalLanguageService.processQuery(
        user.uid,
        query,
        true, // Always try AI first for better responses
      );

      setIsThinking(false);

      // Add assistant response with slight delay for better UX
      setTimeout(() => {
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
        if (result.suggestions && result.suggestions.length > 0) {
          setSuggestions(result.suggestions.map(s => ({fr: s, lingala: ''})));
        }

        // Scroll to bottom after adding assistant message
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }, 300); // Reduced delay for snappier response

    } catch (error) {
      console.error('Query error:', error);
      setIsThinking(false);

      // Enhanced error handling with more helpful messages
      const errorMessage: ConversationMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: "Désolé, je n'ai pas pu traiter votre demande pour le moment. Vérifiez votre connexion internet et réessayez.",
        contentLingala: 'Limbisa, nakoki te kosala eloko oyo lelo. Tala internet na yo mpe meka lisusu.',
        timestamp: new Date(),
      };

      setTimeout(() => {
        setMessages(prev => [...prev, errorMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }, 300);
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
    const isSelected = selectedMessageId === item.id;

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
              colors={[Colors.card.crimson, Colors.card.red]}
              style={styles.avatarGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <Icon name="bot" size="sm" color={Colors.white} />
            </LinearGradient>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => {
            Vibration.vibrate(30);
            setSelectedMessageId(isSelected ? null : item.id);
          }}
          style={[
            styles.messageContent,
            isUser ? styles.userContent : styles.assistantContent,
            isSelected && styles.messageSelected,
          ]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>
            {item.content}
          </Text>

          {item.contentLingala && !isUser && (
            <Text style={styles.lingalaText}>{item.contentLingala}</Text>
          )}

          {/* Timestamp */}
          <Text style={[styles.messageTimestamp, isUser && styles.userTimestamp]}>
            {formatTime(item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp))}
          </Text>

          {/* Message actions (shown when selected) */}
          {isSelected && (
            <View style={styles.messageActions}>
              <TouchableOpacity
                style={styles.messageActionButton}
                onPress={() => handleCopyMessage(item.content)}>
                <Icon name="copy" size="xs" color={Colors.text.secondary} />
                <Text style={styles.messageActionText}>Copier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageActionButton}
                onPress={() => handleShareMessage(item.content)}>
                <Icon name="share" size="xs" color={Colors.text.secondary} />
                <Text style={styles.messageActionText}>Partager</Text>
              </TouchableOpacity>
            </View>
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
        </TouchableOpacity>

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
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

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
        style={[styles.content, isKeyboardVisible && {paddingBottom: keyboardHeight}]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}>
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
                colors={[Colors.card.crimson, Colors.card.red]}
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
                    <Icon
                      name="message-circle"
                      size="sm"
                      color={Colors.primary}
                    />
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
                  <Icon
                    name="chevron-right"
                    size="sm"
                    color={Colors.text.tertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListFooterComponent={
                isLoading ? (
                  <View style={styles.typingIndicator}>
                    <View style={styles.assistantAvatar}>
                      <LinearGradient
                        colors={[Colors.card.crimson, Colors.card.red]}
                        style={styles.avatarGradient}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}>
                        <Icon name="bot" size="sm" color={Colors.white} />
                      </LinearGradient>
                    </View>
                    <View style={styles.typingBubble}>
                      {isThinking ? (
                        // Thinking indicator with text
                        <View style={styles.thinkingContainer}>
                          <Text style={styles.thinkingText}>
                            {Math.random() > 0.5 ? 'Réfléchit...' : 'Analyse vos données...'}
                          </Text>
                          <View style={styles.thinkingDots}>
                            <Animated.View style={[styles.typingDot, {transform: [{translateY: typingDot1}]}]} />
                            <Animated.View style={[styles.typingDot, {transform: [{translateY: typingDot2}]}]} />
                            <Animated.View style={[styles.typingDot, {transform: [{translateY: typingDot3}]}]} />
                          </View>
                        </View>
                      ) : (
                        // Regular typing indicator
                        <>
                          <Animated.View style={[styles.typingDot, {transform: [{translateY: typingDot1}]}]} />
                          <Animated.View style={[styles.typingDot, {transform: [{translateY: typingDot2}]}]} />
                          <Animated.View style={[styles.typingDot, {transform: [{translateY: typingDot3}]}]} />
                        </>
                      )}
                    </View>
                  </View>
                ) : null
              }
            />
          </>
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
        <View
          style={[
            styles.inputContainer,
            {paddingBottom: insets.bottom + Spacing.sm},
          ]}>
          {/* Voice Button */}
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isListening && styles.voiceButtonActive,
            ]}
            onPressIn={startListening}
            onPressOut={stopListening}
            disabled={isLoading}
            activeOpacity={0.8}>
            <Icon
              name={isListening ? 'mic' : 'mic'}
              size="sm"
              color={isListening ? Colors.white : Colors.card.crimson}
            />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isListening ? "Je vous écoute..." : "Tapez votre question..."}
              placeholderTextColor={Colors.text.tertiary}
              multiline
              maxLength={500}
              editable={!isLoading && !isListening}
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
            <LinearGradient
              colors={
                isLoading
                  ? [Colors.card.cosmos, Colors.card.cosmos]
                  : inputText.trim()
                  ? [Colors.card.crimson, Colors.card.red]
                  : [Colors.card.cream, Colors.card.cream]
              }
              style={styles.sendButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              {isLoading ? (
                <Spinner size="small" color={Colors.white} />
              ) : (
                <Icon 
                  name="send" 
                  size="sm" 
                  color={inputText.trim() ? Colors.white : Colors.text.tertiary} 
                />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: Colors.card.red,
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
    fontSize: Typography.fontSize['3xl'],
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
    backgroundColor: Colors.card.cream,
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
    backgroundColor: Colors.card.cosmos,
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
    backgroundColor: Colors.card.cosmos,
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
    borderTopColor: Colors.border.light,
  },
  chartPreview: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card.cream,
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
    color: Colors.card.crimson,
  },
  inlineSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  inlineSuggestionChip: {
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  inlineSuggestionText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.card.crimson,
  },
  suggestionsBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  suggestionsScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionChip: {
    backgroundColor: Colors.card.cream,
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
    borderTopColor: Colors.border.light,
    gap: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
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
  // Voice button styles
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  voiceButtonActive: {
    backgroundColor: Colors.card.crimson,
    borderColor: Colors.card.red,
  },
  // Typing indicator styles
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.sm,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thinkingText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.card.crimson,
  },
  thinkingDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.card.crimson,
  },
  // Message timestamp styles
  messageTimestamp: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  // Message selection styles
  messageSelected: {
    borderWidth: 2,
    borderColor: Colors.card.crimson,
  },
  // Message actions styles
  messageActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: Spacing.md,
  },
  messageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.md,
  },
  messageActionText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
});
