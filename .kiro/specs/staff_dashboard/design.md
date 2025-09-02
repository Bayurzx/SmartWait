# Staff Dashboard - Technical Design

## Architecture Overview

### Dashboard Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Web Dashboard Frontend                  │
│                    (React + TypeScript)                     │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Queue Views   │  Patient Mgmt   │    Analytics Views      │
│                 │                 │                         │
│ • Live Queue    │ • Patient Info  │ • Performance Metrics  │
│ • Call Next     │ • Communication │ • Real-time Charts     │
│ • Manage Queue  │ • Status Update │ • Historical Reports   │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Real-Time Data Layer                       │
│                 (WebSocket + REST APIs)                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────┬─────────────────┬─────────────────────────┤
│  Queue Service  │ Patient Service │   Analytics Service     │
│                 │                 │                         │
│ • Queue State   │ • Patient Data  │ • Metrics Collection   │
│ • Position Mgmt │ • Communication │ • Report Generation    │
│ • Priority Mgmt │ • Status Track  │ • Performance Analysis │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Data Models

### Dashboard Session
```typescript
interface DashboardSession {
  id: string;
  userId: string;
  staffRole: 'front_desk' | 'nurse' | 'doctor' | 'admin' | 'supervisor';
  facilityId: string;
  permissions: string[];
  activeViews: {
    selectedQueues: string[];
    currentPatient?: string;
    dashboardLayout: DashboardLayout;
    filters: DashboardFilters;
  };
  preferences: {
    autoRefresh: boolean;
    refreshInterval: number; // seconds
    notificationSettings: StaffNotificationSettings;
    theme: 'light' | 'dark' | 'auto';
  };
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
}

interface DashboardLayout {
  widgets: Array<{
    id: string;
    type: 'queue_list' | 'patient_detail' | 'metrics' | 'notifications';
    position: { x: number; y: number; width: number; height: number };
    configuration: Record<string, any>;
  }>;
  savedLayouts: Array<{
    name: string;
    isDefault: boolean;
    widgets: any[];
  }>;
}

interface DashboardFilters {
  queueStatus?: ('active' | 'paused' | 'closed')[];
  appointmentTypes?: string[];
  priorityLevels?: number[];
  patientStatus?: ('waiting' | 'called' | 'in_progress' | 'no_show')[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
}
```

### Queue Dashboard View
```typescript
interface QueueDashboardView {
  queueId: string;
  facilityId: string;
  displayInfo: {
    name: string;
    appointmentType: string;
    currentSize: number;
    capacity: number;
    status: 'active' | 'paused' | 'closed';
    averageWaitTime: number;
  };
  patients: Array<{
    id: string;
    position: number;
    name: string;
    appointmentTime?: Date;
    checkedInAt: Date;
    estimatedWaitTime: number;
    status: 'waiting' | 'called' | 'in_progress' | 'remote';
    priority: number;
    specialNeeds?: string[];
    isUrgent: boolean;
    contactInfo: {
      phone: string;
      email: string;
      preferredContact: string;
    };
    location?: {
      isRemote: boolean;
      estimatedArrival?: Date;
      currentDistance?: number;
    };
  }>;
  metrics: {
    averageProcessingTime: number;
    currentThroughput: number;
    satisfactionScore: number;
    noShowRate: number;
  };
  alerts: QueueAlert[];
  lastUpdated: Date;
}

interface QueueAlert {
  id: string;
  type: 'capacity_warning' | 'long_wait' | 'no_show' | 'system_issue';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  patientId?: string;
  queueId: string;
  createdAt: Date;
  acknowledged: boolean;
  actions?: Array<{
    label: string;
    action: string;
    parameters?: Record<string, any>;
  }>;
}
```

## Frontend Implementation

### React Dashboard Components
```typescript
// Main dashboard container
export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const { queues, loading, error } = useQueues(user.facilityId);
  const { socket } = useWebSocket();
  
  useEffect(() => {
    // Join facility room for real-time updates
    socket.emit('join-facility-room', user.facilityId);
    
    return () => {
      socket.emit('leave-facility-room', user.facilityId);
    };
  }, [socket, user.facilityId]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorBoundary error={error} />;

  return (
    <DashboardLayout>
      <Header user={user} />
      <Sidebar queues={queues} />
      <MainContent>
        <QueueOverview queues={queues} />
        <Routes>
          <Route path="/queues/:queueId" element={<QueueDetailView />} />
          <Route path="/patients/:patientId" element={<PatientDetailView />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </MainContent>
    </DashboardLayout>
  );
};

// Queue management component
export const QueueManagement: React.FC<{ queueId: string }> = ({ queueId }) => {
  const { queue, patients } = useQueueDetail(queueId);
  const { callNextPatient, markNoShow, transferPatient } = useQueueActions();
  
  const handleCallNext = async () => {
    try {
      const result = await callNextPatient(queueId);
      toast.success(`Called ${result.patientName} - Room ${result.roomNumber}`);
    } catch (error) {
      toast.error(`Failed to call next patient: ${error.message}`);
    }
  };

  const handlePatientAction = async (patientId: string, action: string) => {
    switch (action) {
      case 'call':
        await callSpecificPatient(patientId);
        break;
      case 'no-show':
        await markNoShow(patientId);
        break;
      case 'transfer':
        // Show transfer dialog
        setTransferDialogOpen({ patientId });
        break;
    }
  };

  return (
    <Card>
      <CardHeader>
        <QueueHeader queue={queue} />
        <QueueActions onCallNext={handleCallNext} />
      </CardHeader>
      <CardContent>
        <PatientList
          patients={patients}
          onPatientAction={handlePatientAction}
          showRemoteStatus={true}
        />
      </CardContent>
    </Card>
  );
};
```

### Real-Time Data Management
```typescript
// WebSocket hook for real-time updates
export const useWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_WEBSOCKET_URL, {
      auth: {
        token: user.token
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    newSocket.on('queue-updated', (data: QueueUpdateEvent) => {
      // Update React Query cache with new data
      queryClient.setQueryData(['queue', data.queueId], (oldData: any) => ({
        ...oldData,
        ...data.updates
      }));
    });

    newSocket.on('patient-called', (data: PatientCalledEvent) => {
      // Show notification to staff
      showStaffNotification({
        type: 'patient-called',
        message: `${data.patientName} called to Room ${data.roomNumber}`,
        patientId: data.patientId
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user.token]);

  return { socket };
};

// React Query hooks for data management
export const useQueues = (facilityId: string) => {
  return useQuery({
    queryKey: ['queues', facilityId],
    queryFn: () => QueueService.getFacilityQueues(facilityId),
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 0 // Always consider stale for real-time data
  });
};

export const useQueueDetail = (queueId: string) => {
  return useQuery({
    queryKey: ['queue', queueId],
    queryFn: () => QueueService.getQueueDetail(queueId),
    refetchInterval: 2000, // More frequent for detailed view
    enabled: !!queueId
  });
};

export const useQueueActions = () => {
  const queryClient = useQueryClient();

  const callNextPatient = useMutation({
    mutationFn: (queueId: string) => QueueService.callNextPatient(queueId),
    onSuccess: (data, queueId) => {
      // Invalidate queue data to trigger refetch
      queryClient.invalidateQueries(['queue', queueId]);
      queryClient.invalidateQueries(['queues']);
      
      // Show success notification
      toast.success(`Called ${data.patientName}`);
    },
    onError: (error) => {
      toast.error(`Failed to call patient: ${error.message}`);
    }
  });

  const markNoShow = useMutation({
    mutationFn: ({ patientId, reason }: { patientId: string; reason: string }) =>
      PatientService.markNoShow(patientId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['queues']);
      toast.info('Patient marked as no-show');
    }
  });

  const transferPatient = useMutation({
    mutationFn: ({ patientId, targetQueueId, reason }: TransferPatientRequest) =>
      QueueService.transferPatient(patientId, targetQueueId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['queues']);
      toast.success('Patient transferred successfully');
    }
  });

  return {
    callNextPatient: callNextPatient.mutate,
    markNoShow: markNoShow.mutate,
    transferPatient: transferPatient.mutate,
    isLoading: callNextPatient.isLoading || markNoShow.isLoading || transferPatient.isLoading
  };
};
```

## Service Architecture

### Dashboard Service
```typescript
export class DashboardService {
  constructor(
    private queueService: QueueService,
    private patientService: PatientService,
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private auditService: AuditService
  ) {}

  async getDashboardData(
    userId: string,
    facilityId: string,
    filters: DashboardFilters
  ): Promise<DashboardData> {
    // Verify staff permissions
    const user = await this.authService.getUser(userId);
    const permissions = await this.authService.getUserPermissions(userId, facilityId);

    // Get queue data based on role
    const queues = await this.getQueuesForRole(facilityId, user.role, permissions);
    
    // Get filtered patient data
    const patients = await this.getFilteredPatients(facilityId, filters, permissions);
    
    // Get real-time metrics
    const metrics = await this.analyticsService.getRealTimeMetrics(facilityId);
    
    // Get alerts and notifications
    const alerts = await this.getActiveAlerts(facilityId, user.role);

    // Log dashboard access
    await this.auditService.logDashboardAccess({
      userId,
      facilityId,
      accessedQueues: queues.map(q => q.id),
      timestamp: new Date()
    });

    return {
      queues,
      patients,
      metrics,
      alerts,
      lastUpdated: new Date()
    };
  }

  async executeStaffAction(
    userId: string,
    action: StaffAction
  ): Promise<ActionResult> {
    // Verify permission for action
    const hasPermission = await this.authService.checkPermission(
      userId,
      action.type,
      action.resourceId
    );

    if (!hasPermission) {
      throw new UnauthorizedError(`User ${userId} not authorized for action ${action.type}`);
    }

    // Execute action with audit logging
    const result = await this.executeAction(action);

    // Log the action
    await this.auditService.logStaffAction({
      userId,
      action: action.type,
      resourceId: action.resourceId,
      parameters: action.parameters,
      result: result.success,
      timestamp: new Date()
    });

    return result;
  }

  private async executeAction(action: StaffAction): Promise<ActionResult> {
    switch (action.type) {
      case 'call_next_patient':
        return await this.handleCallNextPatient(action);
      case 'mark_no_show':
        return await this.handleMarkNoShow(action);
      case 'transfer_patient':
        return await this.handleTransferPatient(action);
      case 'update_priority':
        return await this.handleUpdatePriority(action);
      case 'pause_queue':
        return await this.handlePauseQueue(action);
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  private async handleCallNextPatient(action: StaffAction): Promise<ActionResult> {
    const queue = await this.queueService.getQueue(action.resourceId);
    const nextPatient = await this.queueService.getNextPatient(action.resourceId);

    if (!nextPatient) {
      return {
        success: false,
        message: 'No patients in queue',
        data: null
      };
    }

    // Assign room if specified
    const roomAssignment = action.parameters?.roomId ? 
      await this.assignRoom(nextPatient.id, action.parameters.roomId) : null;

    // Send notification to patient
    await this.notificationService.sendPatientCalledNotification(nextPatient.id, {
      staffName: action.parameters?.staffName,
      roomNumber: roomAssignment?.roomNumber,
      instructions: action.parameters?.instructions
    });

    // Update queue
    await this.queueService.markPatientCalled(nextPatient.id, action.userId);

    return {
      success: true,
      message: `Called ${nextPatient.name}`,
      data: {
        patientId: nextPatient.id,
        patientName: nextPatient.name,
        roomNumber: roomAssignment?.roomNumber
      }
    };
  }
}
```

### Real-Time Dashboard Updates
```typescript
export class DashboardWebSocketHandler {
  constructor(
    private io: Server,
    private authService: AuthService,
    private dashboardService: DashboardService
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const user = await this.authService.verifyToken(token);
        socket.userId = user.id;
        socket.facilityId = user.facilityId;
        socket.role = user.role;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`Staff user ${socket.userId} connected to dashboard`);

      // Join facility-specific room
      socket.join(`facility:${socket.facilityId}`);
      
      // Join role-specific room
      socket.join(`role:${socket.role}:${socket.facilityId}`);

      // Handle dashboard subscriptions
      socket.on('subscribe-queue', (queueId: string) => {
        if (this.canAccessQueue(socket.userId, queueId)) {
          socket.join(`queue:${queueId}`);
        }
      });

      socket.on('unsubscribe-queue', (queueId: string) => {
        socket.leave(`queue:${queueId}`);
      });

      // Handle staff actions
      socket.on('staff-action', async (actionData: StaffAction) => {
        try {
          const result = await this.dashboardService.executeStaffAction(
            socket.userId,
            actionData
          );
          
          socket.emit('action-result', result);
          
          // Broadcast update to other staff members
          this.broadcastStaffAction(socket.facilityId, actionData, result);
          
        } catch (error) {
          socket.emit('action-error', { 
            error: error.message,
            actionId: actionData.id 
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`Staff user ${socket.userId} disconnected`);
      });
    });
  }

  broadcastQueueUpdate(queueId: string, update: QueueUpdate): void {
    this.io.to(`queue:${queueId}`).emit('queue-updated', update);
  }

  broadcastPatientUpdate(facilityId: string, patientUpdate: PatientUpdate): void {
    this.io.to(`facility:${facilityId}`).emit('patient-updated', patientUpdate);
  }

  private broadcastStaffAction(
    facilityId: string,
    action: StaffAction,
    result: ActionResult
  ): void {
    this.io.to(`facility:${facilityId}`).emit('staff-action-completed', {
      action: action.type,
      userId: action.userId,
      result,
      timestamp: new Date()
    });
  }
}
```

### Analytics Integration
```typescript
export class DashboardAnalyticsService {
  constructor(
    private analyticsService: AnalyticsService,
    private cacheService: CacheService
  ) {}

  async getRealTimeMetrics(facilityId: string): Promise<RealTimeMetrics> {
    // Check cache first
    const cached = await this.cacheService.get(`metrics:${facilityId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const metrics = await this.calculateRealTimeMetrics(facilityId);
    
    // Cache for 30 seconds
    await this.cacheService.setex(`metrics:${facilityId}`, 30, JSON.stringify(metrics));
    
    return metrics;
  }

  private async calculateRealTimeMetrics(facilityId: string): Promise<RealTimeMetrics> {
    const [
      queueStats,
      patientFlow,
      staffMetrics,
      satisfactionData
    ] = await Promise.all([
      this.analyticsService.getQueueStatistics(facilityId),
      this.analyticsService.getPatientFlowMetrics(facilityId),
      this.analyticsService.getStaffEfficiencyMetrics(facilityId),
      this.analyticsService.getPatientSatisfactionMetrics(facilityId)
    ]);

    return {
      facility: {
        totalPatients: queueStats.totalPatients,
        averageWaitTime: queueStats.averageWaitTime,
        currentThroughput: patientFlow.currentThroughput,
        capacityUtilization: queueStats.capacityUtilization
      },
      queues: queueStats.queueBreakdown,
      staff: {
        activeProviders: staffMetrics.activeCount,
        averagePatientTime: staffMetrics.averagePatientTime,
        efficiency: staffMetrics.efficiencyScore
      },
      satisfaction: {
        overallScore: satisfactionData.overallScore,
        waitTimeRating: satisfactionData.waitTimeRating,
        serviceRating: satisfactionData.serviceRating
      },
      alerts: await this.getActiveAlerts(facilityId),
      calculatedAt: new Date()
    };
  }

  async generateStaffReport(
    facilityId: string,
    staffId: string,
    dateRange: DateRange
  ): Promise<StaffPerformanceReport> {
    const metrics = await this.analyticsService.getStaffMetrics(staffId, dateRange);
    
    return {
      staffId,
      facilityId,
      period: dateRange,
      metrics: {
        patientsServed: metrics.totalPatients,
        averagePatientTime: metrics.averageConsultationTime,
        queueEfficiency: metrics.queueManagementScore,
        patientSatisfaction: metrics.patientSatisfactionAverage,
        punctuality: metrics.punctualityScore
      },
      trends: await this.calculateStaffTrends(staffId, dateRange),
      recommendations: await this.generateStaffRecommendations(metrics),
      generatedAt: new Date()
    };
  }
}
```

## Performance Optimization

### Dashboard Caching Strategy
```typescript
export class DashboardCacheManager {
  constructor(private redis: Redis) {}

  async cacheQueueView(queueId: string, view: QueueDashboardView): Promise<void> {
    const key = `dashboard:queue:${queueId}`;
    await this.redis.setex(key, 30, JSON.stringify(view)); // 30 second TTL
  }

  async getCachedQueueView(queueId: string): Promise<QueueDashboardView | null> {
    const cached = await this.redis.get(`dashboard:queue:${queueId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateQueueCache(queueId: string): Promise<void> {
    await this.redis.del(`dashboard:queue:${queueId}`);
  }

  async cacheFacilityMetrics(facilityId: string, metrics: any): Promise<void> {
    const key = `dashboard:metrics:${facilityId}`;
    await this.redis.setex(key, 60, JSON.stringify(metrics)); // 1 minute TTL
  }

  // Batch cache invalidation for related data
  async invalidateRelatedCaches(queueId: string): Promise<void> {
    const queue = await this.queueService.getQueue(queueId);
    const pipeline = this.redis.pipeline();
    
    pipeline.del(`dashboard:queue:${queueId}`);
    pipeline.del(`dashboard:metrics:${queue.facilityId}`);
    pipeline.del(`dashboard:alerts:${queue.facilityId}`);
    
    await pipeline.exec();
  }
}
```

### Lazy Loading and Pagination
```typescript
// Efficient patient list component with virtual scrolling
export const PatientList: React.FC<{
  patients: Patient[];
  onPatientAction: (patientId: string, action: string) => void;
}> = ({ patients, onPatientAction }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
  // Virtual scrolling for large patient lists
  const visiblePatients = useMemo(() => {
    return patients.slice(visibleRange.start, visibleRange.end);
  }, [patients, visibleRange]);

  const handleScroll = useCallback((e: React.UIEvent) => {
    const scrollTop = e.currentTarget.scrollTop;
    const itemHeight = 80; // pixels per patient row
    const containerHeight = e.currentTarget.clientHeight;
    
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + 5, // Buffer
      patients.length
    );
    
    setVisibleRange({ start, end });
  }, [patients.length]);

  return (
    <div 
      className="patient-list-container"
      onScroll={handleScroll}
      style={{ height: '600px', overflow: 'auto' }}
    >
      <div style={{ height: patients.length * 80 }}>
        <div style={{ transform: `translateY(${visibleRange.start * 80}px)` }}>
          {visiblePatients.map((patient, index) => (
            <PatientRow
              key={patient.id}
              patient={patient}
              position={visibleRange.start + index + 1}
              onAction={onPatientAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```