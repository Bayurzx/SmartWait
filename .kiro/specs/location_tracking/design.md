# Location Tracking Design

## Technical Architecture Overview

### System Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ React Native    │    │ React/NextJS    │    │  Facility IoT   │
│ Mobile Apps     │    │ Web Dashboard   │    │  (Beacons/WiFi) │
│ (GPS/Indoor)    │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  AWS Location   │
                    │  Service API    │
                    │  Gateway        │
                    └─────────┬───────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼───────┐ ┌─────▼─────┐ ┌─────────▼───────┐
    │ Geofencing      │ │ Indoor    │ │ Location        │
    │ Service         │ │ Position  │ │ Analytics       │
    │ (AWS Location)  │ │ Engine    │ │ Service         │
    └─────────┬───────┘ └─────┬─────┘ └─────────┬───────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                    ┌─────────▼───────┐
                    │  Apache Kafka   │
                    │  Location       │
                    │  Event Stream   │
                    └─────────┬───────┘
                              │
                    ┌─────────▼───────┐
                    │  Location Data  │
                    │  Processing     │
                    │  (Lambda/ECS)   │
                    └─────────┬───────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼───────┐ ┌─────▼─────┐ ┌─────────▼───────┐
    │ Amazon          │ │ Redis     │ │ Amazon          │
    │ DynamoDB        │ │ Cache     │ │ Redshift        │
    │ (Location Data) │ │(Real-time)│ │ (Analytics)     │
    └─────────────────┘ └───────────┘ └─────────────────┘
```

## Core Location Services

### AWS Location Service Integration
```typescript
// AWS Location Service implementation for healthcare facilities
import { LocationClient, CalculateRouteCommand, GetMapTileCommand } from '@aws-sdk/client-location';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

class HealthcareLocationService {
  private locationClient: LocationClient;
  private dynamoClient: DynamoDBClient;
  private geofenceCollection: string;
  private trackingCollection: string;

  constructor() {
    this.locationClient = new LocationClient({ 
      region: process.env.AWS_REGION 
    });
    this.dynamoClient = new DynamoDBClient({ 
      region: process.env.AWS_REGION 
    });
    this.geofenceCollection = 'healthcare-facility-geofences';
    this.trackingCollection = 'patient-location-tracking';
  }

  async createFacilityGeofences(facilityId: string, geofences: GeofenceDefinition[]): Promise<void> {
    const geofenceData = geofences.map(fence => ({
      GeofenceId: `${facilityId}-${fence.name}`,
      Geometry: {
        Polygon: [fence.coordinates] // Array of [longitude, latitude] points
      },
      GeofenceProperties: {
        facilityId,
        fenceType: fence.type, // 'facility', 'parking', 'department', 'emergency_exit'
        radius: fence.radius,
        floor: fence.floor,
        department: fence.department
      }
    }));

    await this.locationClient.batchPutGeofence({
      CollectionName: this.geofenceCollection,
      Entries: geofenceData
    });
  }

  async trackPatientLocation(
    patientId: string, 
    location: LocationUpdate
  ): Promise<LocationTrackingResult> {
    // Privacy-first approach: hash patient ID
    const hashedPatientId = await this.hashPatientId(patientId);
    
    // Check if patient has consented to location tracking
    const consent = await this.getLocationConsent(patientId);
    if (!consent.granted) {
      throw new LocationPrivacyError('Patient has not consented to location tracking');
    }

    // Update patient location in tracking collection
    const trackingUpdate = await this.locationClient.batchUpdateDevicePosition({
      TrackerName: this.trackingCollection,
      Updates: [{
        DeviceId: hashedPatientId,
        Position: [location.longitude, location.latitude],
        SampleTime: new Date(),
        Accuracy: location.accuracy,
        PositionProperties: {
          floor: location.floor?.toString(),
          building: location.building,
          accuracy: location.accuracy.toString()
        }
      }]
    });

    // Store location history with automatic expiration (90 days)
    await this.storeLocationHistory(hashedPatientId, location);

    // Check for geofence events
    const geofenceEvents = await this.checkGeofenceEvents(hashedPatientId, location);

    // Process location-based business logic
    await this.processLocationEvents(patientId, geofenceEvents);

    return {
      success: true,
      geofenceEvents,
      locationAccuracy: location.accuracy,
      timestamp: new Date()
    };
  }

  private async processLocationEvents(
    patientId: string, 
    events: GeofenceEvent[]
  ): Promise<void> {
    for (const event of events) {
      switch (event.eventType) {
        case 'facility-entry':
          await this.handleFacilityEntry(patientId, event);
          break;
        case 'department-entry':
          await this.handleDepartmentEntry(patientId, event);
          break;
        case 'facility-exit':
          await this.handleFacilityExit(patientId, event);
          break;
        case 'parking-area-entry':
          await this.handleParkingEntry(patientId, event);
          break;
      }
    }
  }

  private async handleFacilityEntry(patientId: string, event: GeofenceEvent): Promise<void> {
    // Publish event to Kafka for real-time processing
    await this.kafkaProducer.send({
      topic: 'patient-location-events',
      messages: [{
        key: patientId,
        value: JSON.stringify({
          eventType: 'facility-arrival',
          patientId,
          facilityId: event.facilityId,
          timestamp: new Date().toISOString(),
          location: event.location,
          suggestCheckIn: true
        })
      }]
    });

    // Trigger check-in notification
    await this.notificationService.sendLocationBasedNotification(patientId, {
      type: 'arrival-notification',
      message: 'Welcome! You\'ve arrived at the facility. Would you like to check in for your appointment?',
      actions: ['check-in', 'get-directions', 'find-parking']
    });
  }
}
```

## Indoor Positioning System

### Bluetooth Beacon and WiFi Triangulation
```typescript
// Indoor positioning using Bluetooth beacons and WiFi triangulation
class IndoorPositioningService {
  private beaconMap: Map<string, BeaconLocation>;
  private wifiAccessPoints: Map<string, WiFiAccessPoint>;

  constructor() {
    this.beaconMap = new Map();
    this.wifiAccessPoints = new Map();
  }

  async calculateIndoorPosition(
    beaconReadings: BeaconReading[],
    wifiSignals: WiFiSignal[]
  ): Promise<IndoorPosition> {
    // Use trilateration algorithm with Bluetooth beacons
    const beaconPosition = await this.trilaterateFromBeacons(beaconReadings);
    
    // Use WiFi RSSI triangulation as backup/validation
    const wifiPosition = await this.triangulateFromWiFi(wifiSignals);
    
    // Combine readings for improved accuracy
    const combinedPosition = this.combinePositionEstimates([
      { position: beaconPosition, confidence: 0.7, method: 'bluetooth' },
      { position: wifiPosition, confidence: 0.3, method: 'wifi' }
    ]);

    // Apply facility-specific corrections
    const correctedPosition = await this.applyFacilityCorrections(
      combinedPosition,
      beaconReadings[0]?.facilityId
    );

    return {
      x: correctedPosition.x,
      y: correctedPosition.y,
      floor: correctedPosition.floor,
      building: correctedPosition.building,
      accuracy: correctedPosition.accuracy,
      confidence: correctedPosition.confidence,
      method: 'hybrid-indoor',
      timestamp: new Date()
    };
  }

  private async trilaterateFromBeacons(readings: BeaconReading[]): Promise<Position> {
    if (readings.length < 3) {
      throw new Error('At least 3 beacon readings required for trilateration');
    }

    // Sort by signal strength for better accuracy
    readings.sort((a, b) => b.rssi - a.rssi);
    const topBeacons = readings.slice(0, 4); // Use top 4 strongest signals

    // Convert RSSI to distance using facility-calibrated formula
    const distances = topBeacons.map(reading => ({
      beacon: this.beaconMap.get(reading.beaconId)!,
      distance: this.rssiToDistance(reading.rssi, reading.txPower)
    }));

    // Apply trilateration algorithm
    return this.trilaterate(distances);
  }

  private rssiToDistance(rssi: number, txPower: number): number {
    // Calibrated formula for healthcare facility environment
    // Accounts for walls, medical equipment interference
    const pathLoss = txPower - rssi;
    const environmentFactor = 2.2; // Calibrated for hospital environment
    return Math.pow(10, (pathLoss - 40) / (10 * environmentFactor));
  }

  async setupFacilityBeacons(
    facilityId: string, 
    beacons: BeaconConfiguration[]
  ): Promise<void> {
    // Install and configure Bluetooth beacons throughout facility
    for (const beacon of beacons) {
      await this.registerBeacon({
        beaconId: beacon.id,
        facilityId,
        location: beacon.location,
        txPower: beacon.txPower,
        floor: beacon.floor,
        department: beacon.department,
        calibrationData: beacon.calibration
      });
    }

    // Create beacon coverage map
    await this.generateCoverageMap(facilityId, beacons);
  }
}
```

## Mobile Application Integration

### React Native Location Services
```typescript
// React Native location tracking with privacy controls
import { useEffect, useState } from 'react';
import Geolocation from '@react-native-community/geolocation';
import BackgroundGeolocation from '@react-native-async-storage/async-storage';
import { BleManager } from 'react-native-ble-plx';

interface LocationTrackingHook {
  location: LocationData | null;
  isTracking: boolean;
  accuracy: number;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  updateConsent: (consent: LocationConsent) => Promise<void>;
}

export const useLocationTracking = (
  facilityId: string,
  patientId: string
): LocationTrackingHook => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const bleManager = new BleManager();

  const startTracking = async (): Promise<void> => {
    try {
      // Check location permissions
      const hasPermission = await checkLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      // Check patient consent
      const consent = await getLocationConsent(patientId);
      if (!consent.granted) {
        throw new Error('Patient has not consented to location tracking');
      }

      setIsTracking(true);

      // Start GPS tracking with battery optimization
      const locationOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        distanceFilter: 5, // Only update if moved 5 meters
        interval: 30000, // Update every 30 seconds
        fastestInterval: 15000
      };

      const watchId = Geolocation.watchPosition(
        (position) => {
          handleLocationUpdate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp),
            source: 'gps'
          });
        },
        (error) => setError(error.message),
        locationOptions
      );

      // Start indoor positioning when near facility
      await startIndoorPositioning();

    } catch (err) {
      setError(err.message);
      setIsTracking(false);
    }
  };

  const startIndoorPositioning = async (): Promise<void> => {
    // Scan for facility Bluetooth beacons
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('BLE scan error:', error);
        return;
      }

      if (device && isFacilityBeacon(device, facilityId)) {
        // Process beacon data for indoor positioning
        processBeaconReading({
          beaconId: device.id,
          rssi: device.rssi,
          txPower: device.txPower,
          facilityId,
          timestamp: new Date()
        });
      }
    });

    // Start WiFi scanning for triangulation
    await startWiFiScanning();
  };

  const handleLocationUpdate = async (locationData: LocationData): Promise<void> => {
    setLocation(locationData);
    setAccuracy(locationData.accuracy);

    // Send location update to backend with privacy protection
    try {
      await locationService.updatePatientLocation(patientId, {
        ...locationData,
        facilityId,
        consentTimestamp: await getConsentTimestamp(patientId)
      });
    } catch (error) {
      console.error('Location update failed:', error);
    }
  };

  const stopTracking = (): void => {
    setIsTracking(false);
    Geolocation.clearWatch(watchId);
    bleManager.stopDeviceScan();
    setLocation(null);
  };

  const updateConsent = async (consent: LocationConsent): Promise<void> => {
    await storeLocationConsent(patientId, consent);
    
    if (!consent.granted && isTracking) {
      stopTracking();
    }
  };

  return {
    location,
    isTracking,
    accuracy,
    error,
    startTracking,
    stopTracking,
    updateConsent
  };
};
```

## Privacy and Compliance Framework

### HIPAA-Compliant Location Data Handling
```typescript
// Privacy-first location data management
class LocationPrivacyService {
  private encryptionService: EncryptionService;
  private auditLogger: AuditLogger;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.auditLogger = new AuditLogger();
  }

  async storeLocationData(
    patientId: string, 
    locationData: LocationData
  ): Promise<void> {
    // Encrypt patient ID and location data
    const encryptedPatientId = await this.encryptionService.encrypt(patientId);
    const encryptedLocation = await this.encryptionService.encrypt(
      JSON.stringify(locationData)
    );

    // Store with automatic expiration (90 days)
    const expirationTimestamp = Date.now() + (90 * 24 * 60 * 60 * 1000);
    
    await this.dynamoClient.putItem({
      TableName: 'patient-locations',
      Item: {
        hashedPatientId: { S: await this.hashPatientId(patientId) },
        encryptedLocation: { S: encryptedLocation },
        timestamp: { N: Date.now().toString() },
        expirationTime: { N: expirationTimestamp.toString() },
        dataClassification: { S: 'PHI-LOCATION' },
        consentVersion: { S: await this.getConsentVersion(patientId) }
      }
    });

    // Audit log for compliance
    await this.auditLogger.logLocationDataAccess({
      action: 'STORE_LOCATION',
      patientId: await this.hashPatientId(patientId),
      timestamp: new Date(),
      dataType: 'LOCATION_COORDINATES',
      compliance: 'HIPAA',
      retention: '90_DAYS'
    });
  }

  async getLocationConsent(patientId: string): Promise<LocationConsent> {
    const consent = await this.dynamoClient.query({
      TableName: 'patient-consents',
      KeyConditionExpression: 'patientId = :pid AND consentType = :type',
      ExpressionAttributeValues: {
        ':pid': { S: await this.hashPatientId(patientId) },
        ':type': { S: 'LOCATION_TRACKING' }
      },
      ScanIndexForward: false, // Get latest consent
      Limit: 1
    });

    if (!consent.Items || consent.Items.length === 0) {
      return { granted: false, timestamp: null, version: null };
    }

    const item = consent.Items[0];
    return {
      granted: item.granted.BOOL,
      timestamp: new Date(parseInt(item.timestamp.N)),
      version: item.version.S,
      granularSettings: JSON.parse(item.granularSettings.S || '{}')
    };
  }

  async deletePatientLocationData(patientId: string): Promise<void> {
    const hashedId = await this.hashPatientId(patientId);
    
    // Query all location data for patient
    const locationData = await this.dynamoClient.query({
      TableName: 'patient-locations',
      KeyConditionExpression: 'hashedPatientId = :id',
      ExpressionAttributeValues: {
        ':id': { S: hashedId }
      }
    });

    // Batch delete all location records
    if (locationData.Items && locationData.Items.length > 0) {
      const deleteRequests = locationData.Items.map(item => ({
        DeleteRequest: {
          Key: {
            hashedPatientId: item.hashedPatientId,
            timestamp: item.timestamp
          }
        }
      }));

      await this.dynamoClient.batchWriteItem({
        RequestItems: {
          'patient-locations': deleteRequests
        }
      });
    }

    // Audit log for compliance
    await this.auditLogger.logLocationDataAccess({
      action: 'DELETE_ALL_LOCATION_DATA',
      patientId: hashedId,
      timestamp: new Date(),
      recordCount: locationData.Items?.length || 0,
      reason: 'PATIENT_REQUEST',
      compliance: 'GDPR_RIGHT_TO_ERASURE'
    });
  }

  private async hashPatientId(patientId: string): Promise<string> {
    // Use HMAC-SHA256 with facility-specific secret
    const secret = process.env.LOCATION_HASH_SECRET;
    const hash = crypto.createHmac('sha256', secret);
    hash.update(patientId);
    return hash.digest('hex');
  }
}
```

## Location Analytics and Insights

### Real-Time Location Analytics
```typescript
// Location analytics for facility optimization
class LocationAnalyticsService {
  private redshiftClient: RedshiftClient;
  private kafkaConsumer: Consumer;

  async generateFacilityFlowAnalytics(
    facilityId: string,
    timeRange: DateRange
  ): Promise<FacilityFlowAnalytics> {
    // Anonymized patient flow analysis
    const query = `
      SELECT 
        department_id,
        hour_of_day,
        COUNT(DISTINCT anonymous_patient_id) as patient_count,
        AVG(dwell_time_minutes) as avg_dwell_time,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY dwell_time_minutes) as median_dwell_time,
        COUNT(*) as total_visits
      FROM location_analytics_fact 
      WHERE facility_id = '${facilityId}'
        AND date_key BETWEEN '${timeRange.start}' AND '${timeRange.end}'
        AND location_type IN ('waiting_area', 'examination_room', 'procedure_room')
      GROUP BY department_id, hour_of_day
      ORDER BY department_id, hour_of_day;
    `;

    const results = await this.redshiftClient.query(query);
    
    return {
      facilityId,
      timeRange,
      departmentMetrics: this.processDepartmentMetrics(results.rows),
      bottleneckAreas: await this.identifyBottlenecks(facilityId, results.rows),
      optimizationRecommendations: await this.generateOptimizationRecommendations(
        facilityId, 
        results.rows
      ),
      privacyCompliant: true,
      anonymizationLevel: 'HIGH'
    };
  }

  private async identifyBottlenecks(
    facilityId: string, 
    flowData: any[]
  ): Promise<BottleneckAnalysis[]> {
    const bottlenecks = [];

    // Identify areas with high dwell times
    const highDwellAreas = flowData.filter(d => d.avg_dwell_time > 30);
    
    // Identify areas with high patient density
    const highDensityAreas = flowData.filter(d => d.patient_count > 20);
    
    for (const area of highDwellAreas) {
      bottlenecks.push({
        type: 'high-dwell-time',
        location: area.department_id,
        severity: this.calculateSeverity(area.avg_dwell_time),
        recommendation: await this.getBottleneckRecommendation(
          'high-dwell-time', 
          area
        ),
        impactedPatients: area.patient_count
      });
    }

    return bottlenecks;
  }

  async generateWaitTimeOptimizationModel(
    facilityId: string
  ): Promise<WaitTimeModel> {
    // Use machine learning to optimize wait times based on location patterns
    const trainingData = await this.getLocationWaitTimeData(facilityId);
    
    const model = await this.sagemakerService.trainModel({
      algorithm: 'linear-learner',
      features: [
        'current_queue_length',
        'historical_flow_pattern',
        'patient_location_distribution',
        'staff_availability',
        'time_of_day',
        'day_of_week'
      ],
      target: 'actual_wait_time',
      data: trainingData
    });

    return {
      modelId: model.modelId,
      accuracy: model.accuracy,
      features: model.features,
      predictions: await this.generateWaitTimePredictions(facilityId, model)
    };
  }
}
```

## Emergency Location Services

### Emergency Response Integration
```typescript
// Emergency location services for healthcare facilities
class EmergencyLocationService {
  private emergencyProtocols: Map<string, EmergencyProtocol>;
  private alertingService: AlertingService;

  async activateEmergencyMode(
    facilityId: string,
    emergencyType: EmergencyType
  ): Promise<void> {
    const protocol = this.emergencyProtocols.get(emergencyType);
    if (!protocol) {
      throw new Error(`No emergency protocol found for type: ${emergencyType}`);
    }

    // Override privacy settings for emergency access
    await this.enableEmergencyLocationAccess(facilityId, emergencyType);

    // Get all current locations in facility
    const currentOccupants = await this.getCurrentFacilityOccupants(facilityId);

    // Process emergency response based on type
    switch (emergencyType) {
      case 'medical-emergency':
        await this.handleMedicalEmergency(facilityId, currentOccupants);
        break;
      case 'fire-evacuation':
        await this.handleFireEvacuation(facilityId, currentOccupants);
        break;
      case 'security-lockdown':
        await this.handleSecurityLockdown(facilityId, currentOccupants);
        break;
      case 'natural-disaster':
        await this.handleNaturalDisaster(facilityId, currentOccupants);
        break;
    }

    // Log emergency location access for audit
    await this.auditLogger.logEmergencyAccess({
      facilityId,
      emergencyType,
      occupantCount: currentOccupants.length,
      timestamp: new Date(),
      accessJustification: protocol.legalJustification
    });
  }

  private async handleFireEvacuation(
    facilityId: string,
    occupants: LocationData[]
  ): Promise<void> {
    // Get evacuation routes based on current locations
    const evacuationPlan = await this.calculateOptimalEvacuationRoutes(
      facilityId,
      occupants
    );

    // Send evacuation instructions to all occupants
    for (const route of evacuationPlan.routes) {
      await this.alertingService.sendEmergencyAlert(
        route.occupants.map(o => o.patientId),
        {
          type: 'evacuation-instruction',
          priority: 'CRITICAL',
          message: `FIRE EVACUATION: Proceed immediately to ${route.exitName}. Follow the highlighted path on your device.`,
          routeGuidance: route.waypoints,
          estimatedTime: route.estimatedTime
        }
      );
    }

    // Notify emergency responders with facility map and occupant locations
    await this.notifyEmergencyResponders({
      facilityId,
      emergencyType: 'fire',
      occupantCount: occupants.length,
      facilityMap: await this.getFacilityEmergencyMap(facilityId),
      occupantLocations: this.anonymizeForEmergencyResponse(occupants)
    });
  }

  async trackEvacuationProgress(
    facilityId: string,
    evacuationId: string
  ): Promise<EvacuationStatus> {
    const currentOccupants = await this.getCurrentFacilityOccupants(facilityId);
    const initialCount = await this.getInitialEvacuationCount(evacuationId);
    
    return {
      evacuationId,
      startTime: await this.getEvacuationStartTime(evacuationId),
      currentTime: new Date(),
      initialOccupants: initialCount,
      currentOccupants: currentOccupants.length,
      evacuatedCount: initialCount - currentOccupants.length,
      evacuationProgress: ((initialCount - currentOccupants.length) / initialCount) * 100,
      estimatedCompletionTime: await this.estimateEvacuationCompletion(
        currentOccupants.length,
        evacuationId
      ),
      remainingOccupantAreas: this.groupOccupantsByArea(currentOccupants)
    };
  }
}
```

## Performance Optimization

### Battery-Optimized Location Tracking
```typescript
// Battery-optimized location tracking for mobile devices
class BatteryOptimizedLocationService {
  private adaptiveUpdateInterval: number = 30000; // Start with 30 seconds
  private batteryThresholds = {
    high: 50, // > 50% battery
    medium: 20, // 20-50% battery
    low: 10 // < 20% battery
  };

  async optimizeLocationTracking(
    batteryLevel: number,
    locationContext: LocationContext
  ): Promise<LocationTrackingConfig> {
    const config: LocationTrackingConfig = {
      updateInterval: this.calculateOptimalInterval(batteryLevel, locationContext),
      accuracy: this.calculateOptimalAccuracy(batteryLevel, locationContext),
      enableBackgroundTracking: this.shouldEnableBackgroundTracking(batteryLevel),
      geofenceRadius: this.calculateOptimalGeofenceRadius(batteryLevel),
      bluetoothScanInterval: this.calculateBluetoothInterval(batteryLevel)
    };

    //