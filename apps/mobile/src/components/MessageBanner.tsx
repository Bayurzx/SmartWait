// apps\mobile\src\components\MessageBanner.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MessageBannerProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onDismiss?: () => void;
  visible?: boolean;
}

export const MessageBanner: React.FC<MessageBannerProps> = ({
  type,
  message,
  onDismiss,
  visible = true,
}) => {
  if (!visible) return null;

  const getStylesForType = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#D1FAE5',
          borderColor: '#10B981',
          textColor: '#065F46',
          icon: '✅',
        };
      case 'error':
        return {
          backgroundColor: '#FEE2E2',
          borderColor: '#EF4444',
          textColor: '#991B1B',
          icon: '❌',
        };
      case 'warning':
        return {
          backgroundColor: '#FEF3C7',
          borderColor: '#F59E0B',
          textColor: '#92400E',
          icon: '⚠️',
        };
      case 'info':
      default:
        return {
          backgroundColor: '#DBEAFE',
          borderColor: '#3B82F6',
          textColor: '#1E40AF',
          icon: 'ℹ️',
        };
    }
  };

  const typeStyles = getStylesForType();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: typeStyles.backgroundColor,
          borderColor: typeStyles.borderColor,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{typeStyles.icon}</Text>
        <Text
          style={[
            styles.message,
            { color: typeStyles.textColor },
          ]}
        >
          {message}
        </Text>
      </View>
      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
        >
          <Text style={[styles.dismissText, { color: typeStyles.textColor }]}>
            ×
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  dismissButton: {
    marginLeft: 8,
    padding: 4,
  },
  dismissText: {
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
});

export default MessageBanner;