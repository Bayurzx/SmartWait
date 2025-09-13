// apps\mobile\src\services\navigation.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppScreen = 'checkin' | 'queue' | 'loading';

export interface NavigationState {
  currentScreen: AppScreen;
  patientId?: string;
}

export class NavigationService {
  private static instance: NavigationService;
  private listeners: ((state: NavigationState) => void)[] = [];
  private currentState: NavigationState = { currentScreen: 'loading' };

  static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  private constructor() {}

  getCurrentState(): NavigationState {
    return { ...this.currentState };
  }

  subscribe(listener: (state: NavigationState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getCurrentState()));
  }

  async initializeNavigation(): Promise<void> {
    try {
      const storedPatientId = await AsyncStorage.getItem('patientId');
      
      if (storedPatientId) {
        this.currentState = {
          currentScreen: 'queue',
          patientId: storedPatientId,
        };
      } else {
        this.currentState = {
          currentScreen: 'checkin',
        };
      }
    } catch (error) {
      console.error('Error initializing navigation:', error);
      this.currentState = {
        currentScreen: 'checkin',
      };
    }
    
    this.notifyListeners();
  }

  async navigateToQueue(patientId: string): Promise<void> {
    try {
      await AsyncStorage.setItem('patientId', patientId);
      this.currentState = {
        currentScreen: 'queue',
        patientId,
      };
      this.notifyListeners();
    } catch (error) {
      console.error('Error navigating to queue:', error);
    }
  }

  async navigateToCheckIn(): Promise<void> {
    try {
      await AsyncStorage.removeItem('patientId');
      await AsyncStorage.removeItem('patientName');
      await AsyncStorage.removeItem('patientPhone');
      
      this.currentState = {
        currentScreen: 'checkin',
      };
      this.notifyListeners();
    } catch (error) {
      console.error('Error navigating to check-in:', error);
    }
  }

  setLoading(): void {
    this.currentState = {
      currentScreen: 'loading',
    };
    this.notifyListeners();
  }
}

export const navigationService = NavigationService.getInstance();