import Constants from 'expo-constants';

export interface AppConfig {
  apiUrl: string;
  websocketUrl: string;
  environment: 'development' | 'staging' | 'production';
  enableWebSocket: boolean;
  pollingInterval: number;
  fallbackPollingInterval: number;
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    // Get configuration from environment variables or Constants
    const extra = Constants.expoConfig?.extra || {};
    
    // Default configuration
    const defaultConfig: AppConfig = {
      apiUrl: 'http://localhost:3001',
      websocketUrl: 'http://localhost:3001',
      environment: 'development',
      enableWebSocket: true,
      pollingInterval: 30000, // 30 seconds when WebSocket is connected
      fallbackPollingInterval: 10000, // 10 seconds when WebSocket is not connected
    };

    // Override with environment-specific values
    return {
      apiUrl: extra.API_URL || process.env.EXPO_PUBLIC_API_URL || defaultConfig.apiUrl,
      websocketUrl: extra.WEBSOCKET_URL || process.env.EXPO_PUBLIC_WEBSOCKET_URL || defaultConfig.websocketUrl,
      environment: extra.ENVIRONMENT || process.env.EXPO_PUBLIC_ENVIRONMENT || defaultConfig.environment,
      enableWebSocket: extra.ENABLE_WEBSOCKET !== false && process.env.EXPO_PUBLIC_ENABLE_WEBSOCKET !== 'false',
      pollingInterval: parseInt(extra.POLLING_INTERVAL || process.env.EXPO_PUBLIC_POLLING_INTERVAL || '30000'),
      fallbackPollingInterval: parseInt(extra.FALLBACK_POLLING_INTERVAL || process.env.EXPO_PUBLIC_FALLBACK_POLLING_INTERVAL || '10000'),
    };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  getApiUrl(): string {
    return this.config.apiUrl;
  }

  getWebSocketUrl(): string {
    return this.config.websocketUrl;
  }

  isWebSocketEnabled(): boolean {
    return this.config.enableWebSocket;
  }

  getPollingInterval(): number {
    return this.config.pollingInterval;
  }

  getFallbackPollingInterval(): number {
    return this.config.fallbackPollingInterval;
  }

  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  // Allow runtime configuration updates (useful for testing)
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export const configService = ConfigService.getInstance();