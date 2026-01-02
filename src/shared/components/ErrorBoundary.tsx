// Error Boundary Component
// Catches React component errors and prevents app crashes

import React, {Component, ErrorInfo, ReactNode} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {Colors, Typography, Spacing} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {analyticsService} from '@/shared/services';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * 
 * Wraps components to catch and handle errors gracefully
 * Prevents entire app from crashing due to component errors
 * 
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * @example With custom fallback
 * <ErrorBoundary fallback={(error, reset) => <CustomError error={error} onReset={reset} />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to analytics/crash reporting service
    console.error('Error Boundary caught an error:', error, errorInfo);

    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to analytics
    analyticsService.logError('error_boundary_catch', 
      `${error.message} | Stack: ${error.stack?.substring(0, 100)} | Component: ${errorInfo.componentStack?.substring(0, 100)}`
    );
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Icon name="alert-circle" size="xl" color="#DC2626" />
            </View>

            <Text style={styles.title}>Oops! Une erreur s'est produite</Text>

            <Text style={styles.message}>
              Quelque chose s'est mal passé. Nous en avons été informés et travaillons sur une solution.
            </Text>

            {__DEV__ && this.state.error && (
              <ScrollView style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Détails de l'erreur (dev only):</Text>
                <Text style={styles.debugText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.error.stack && (
                  <Text style={styles.debugStack}>
                    {this.state.error.stack}
                  </Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.button}
              onPress={this.resetError}
              activeOpacity={0.7}>
              <Icon name="refresh-cw" size="md" color={Colors.white} />
              <Text style={styles.buttonText}>Réessayer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                // Navigate to home or safe screen
                this.resetError();
              }}
              activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.status.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  debugContainer: {
    width: '100%',
    maxHeight: 200,
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  debugTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  debugText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: 'monospace',
    color: Colors.status.error,
    marginBottom: Spacing.sm,
  },
  debugStack: {
    fontSize: Typography.fontSize.xs,
    fontFamily: 'monospace',
    color: Colors.text.tertiary,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    width: '100%',
    marginBottom: Spacing.md,
  },
  buttonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.white,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.primary,
    fontWeight: '500',
  },
});

/**
 * Higher-order component to wrap any component with ErrorBoundary
 * 
 * @example
 * const SafeComponent = withErrorBoundary(MyComponent);
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, resetError: () => void) => ReactNode
): React.ComponentType<P> {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
