// apps\mobile\src\screens\SavedCheckinsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, SavedCheckin } from '../services/api';
import { checkinHistoryService } from '../services/checkin-history';

interface SavedCheckinsScreenProps {
    onSelectCheckin: (patientId: string) => void;
    onBackToCheckIn: () => void;
    apiUrl?: string;
}

export const SavedCheckinsScreen: React.FC<SavedCheckinsScreenProps> = ({
    onSelectCheckin,
    onBackToCheckIn,
    apiUrl = 'http://localhost:3001'
}) => {
    const [savedCheckins, setSavedCheckins] = useState<SavedCheckin[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [validatingCheckin, setValidatingCheckin] = useState<string | null>(null);
    const [deviceId, setDeviceId] = useState<string>('');

    useEffect(() => {
        initializeAndLoadData();
    }, []);

    const initializeAndLoadData = async () => {
        try {
            // Configure API service
            if (apiUrl) {
                apiService['baseUrl'] = apiUrl;
            }

            // Get device ID
            const id = await checkinHistoryService.getDeviceId();
            setDeviceId(id);

            // Load saved check-ins
            await loadSavedCheckins(id);
        } catch (error) {
            console.error('Error initializing saved check-ins:', error);
            setLoading(false);
        }
    };

    const loadSavedCheckins = async (deviceId?: string) => {
        try {
            const id = deviceId || await checkinHistoryService.getDeviceId();
            const checkins = await apiService.getSavedCheckins(id);
            setSavedCheckins(checkins);
        } catch (error) {
            console.error('Error loading saved check-ins:', error);
            Alert.alert(
                'Connection Error',
                'Unable to load your saved check-ins. Please check your internet connection.',
                [
                    { text: 'Retry', onPress: () => loadSavedCheckins() },
                    { text: 'Back', onPress: onBackToCheckIn },
                ]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadSavedCheckins();
    }, []);

    const handleSelectCheckin = async (checkin: SavedCheckin) => {
        setValidatingCheckin(checkin.patientId);

        try {
            // Validate if the check-in is still active
            const validation = await apiService.validateSavedCheckin(checkin.patientId);

            if (validation.isValid && validation.status !== 'completed') {
                // Store patient info for the queue screen
                await AsyncStorage.setItem('patientId', checkin.patientId);
                if (checkin.patientName) {
                    await AsyncStorage.setItem('patientName', checkin.patientName);
                }

                onSelectCheckin(checkin.patientId);
            } else {
                Alert.alert(
                    'Check-in No Longer Active',
                    'This check-in is no longer active. It may have been completed or expired.',
                    [
                        {
                            text: 'Remove from List',
                            onPress: () => handleRemoveCheckin(checkin),
                            style: 'destructive',
                        },
                        { text: 'Cancel' },
                    ]
                );
            }
        } catch (error) {
            console.error('Error validating saved check-in:', error);
            Alert.alert(
                'Validation Error',
                'Unable to validate this check-in. Would you like to try anyway?',
                [
                    {
                        text: 'Try Anyway',
                        onPress: async () => {
                            await AsyncStorage.setItem('patientId', checkin.patientId);
                            if (checkin.patientName) {
                                await AsyncStorage.setItem('patientName', checkin.patientName);
                            }
                            onSelectCheckin(checkin.patientId);
                        },
                    },
                    { text: 'Cancel' },
                ]
            );
        } finally {
            setValidatingCheckin(null);
        }
    };

    const handleRemoveCheckin = (checkin: SavedCheckin) => {
        Alert.alert(
            'Remove Saved Check-in',
            `Remove "${checkin.patientName || 'Unnamed'}" from your saved check-ins?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiService.removeSavedCheckin(checkin.patientId, deviceId);
                            setSavedCheckins(prev =>
                                prev.filter(c => c.patientId !== checkin.patientId)
                            );
                        } catch (error) {
                            console.error('Error removing saved check-in:', error);
                            Alert.alert(
                                'Error',
                                'Unable to remove saved check-in. Please try again.'
                            );
                        }
                    },
                },
            ]
        );
    };

    const formatCheckinTime = (checkinTime: string): string => {
        const date = new Date(checkinTime);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInHours * 60);
            return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
        } else if (diffInHours < 24) {
            const hours = Math.floor(diffInHours);
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diffInHours / 24);
            if (days < 7) {
                return `${days} day${days !== 1 ? 's' : ''} ago`;
            } else {
                return date.toLocaleDateString();
            }
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Loading your saved check-ins...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Saved Check-ins</Text>
                <Text style={styles.subtitle}>
                    Select a previous check-in to view its current status
                </Text>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {savedCheckins.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No Saved Check-ins</Text>
                        <Text style={styles.emptyText}>
                            When you check in, we'll save it here so you can easily access it later.
                        </Text>
                        <TouchableOpacity style={styles.newCheckinButton} onPress={onBackToCheckIn}>
                            <Text style={styles.newCheckinButtonText}>Start New Check-in</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {savedCheckins.map((checkin) => (
                            <View key={checkin.id} style={styles.checkinCard}>
                                <View style={styles.checkinHeader}>
                                    <Text style={styles.patientName}>
                                        {checkin.patientName || 'Unnamed Patient'}
                                    </Text>
                                    <Text style={styles.checkinTime}>
                                        {formatCheckinTime(checkin.checkinTime)}
                                    </Text>
                                </View>

                                <View style={styles.checkinDetails}>
                                    <Text style={styles.facilityName}>
                                        {checkin.facilityName || 'Healthcare Facility'}
                                    </Text>
                                    <Text style={styles.patientId}>ID: {checkin.patientId}</Text>
                                </View>

                                <View style={styles.checkinActions}>
                                    <TouchableOpacity
                                        style={[
                                            styles.selectButton,
                                            validatingCheckin === checkin.patientId && styles.buttonDisabled
                                        ]}
                                        onPress={() => handleSelectCheckin(checkin)}
                                        disabled={validatingCheckin === checkin.patientId}
                                    >
                                        {validatingCheckin === checkin.patientId ? (
                                            <ActivityIndicator color="white" size="small" />
                                        ) : (
                                            <Text style={styles.selectButtonText}>View Status</Text>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => handleRemoveCheckin(checkin)}
                                    >
                                        <Text style={styles.removeButtonText}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <View style={styles.bottomActions}>
                            <TouchableOpacity style={styles.newCheckinButton} onPress={onBackToCheckIn}>
                                <Text style={styles.newCheckinButtonText}>New Check-in</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    checkinCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    checkinHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    patientName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
    },
    checkinTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    checkinDetails: {
        marginBottom: 16,
    },
    facilityName: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    patientId: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: 'monospace',
    },
    checkinActions: {
        flexDirection: 'row',
        gap: 8,
    },
    selectButton: {
        flex: 1,
        backgroundColor: '#2563EB',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    selectButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    removeButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    removeButtonText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '500',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    bottomActions: {
        paddingVertical: 20,
    },
    newCheckinButton: {
        backgroundColor: '#059669',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
    },
    newCheckinButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SavedCheckinsScreen;