// apps\api\src\controllers\checkin-history-controller.ts
import { Request, Response } from 'express';
import { CheckinHistoryService } from '../services/checkin-history-service';

export class CheckinHistoryController {
  private checkinHistoryService: CheckinHistoryService;

  constructor() {
    this.checkinHistoryService = new CheckinHistoryService();
  }

  /**
   * Get saved check-ins for a device/browser
   */
  async getSavedCheckins(req: Request, res: Response): Promise<void> {
    try {
      const deviceId = req.query.deviceId as string;
      
      if (!deviceId) {
        res.status(400).json({
          errors: [{
            status: '400',
            code: 'MISSING_DEVICE_ID',
            title: 'Device ID Required',
            detail: 'Device ID is required to retrieve saved check-ins'
          }]
        });
        return;
      }

      const checkins = await this.checkinHistoryService.getSavedCheckins(deviceId);
      
      res.status(200).json({
        data: checkins,
        meta: {
          total: checkins.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting saved check-ins:', error);
      res.status(500).json({
        errors: [{
          status: '500',
          code: 'INTERNAL_ERROR',
          title: 'Internal Server Error',
          detail: 'Failed to retrieve saved check-ins'
        }]
      });
    }
  }

  /**
   * Save a check-in for future reference
   */
  async saveCheckin(req: Request, res: Response): Promise<void> {
    try {
      const { patientId, deviceId, patientName, facilityName } = req.body;
      
      if (!patientId || !deviceId) {
        res.status(400).json({
          errors: [{
            status: '400',
            code: 'MISSING_REQUIRED_FIELDS',
            title: 'Missing Required Fields',
            detail: 'Patient ID and Device ID are required'
          }]
        });
        return;
      }

      const savedCheckin = await this.checkinHistoryService.saveCheckin({
        patientId,
        deviceId,
        patientName,
        facilityName,
        checkinTime: new Date()
      });
      
      res.status(201).json({
        data: savedCheckin,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error saving check-in:', error);
      console.error('Error details:', error);
      res.status(500).json({
        errors: [{
          status: '500',
          code: 'INTERNAL_ERROR',
          title: 'Internal Server Error',
          detail: 'Failed to save check-in'
        }]
      });
    }
  }

  /**
   * Remove a saved check-in
   */
  async removeSavedCheckin(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const deviceId = req.query.deviceId as string;
      
      if (!deviceId) {
        res.status(400).json({
          errors: [{
            status: '400',
            code: 'MISSING_DEVICE_ID',
            title: 'Device ID Required',
            detail: 'Device ID is required to remove saved check-in'
          }]
        });
        return;
      }

      const removed = await this.checkinHistoryService.removeSavedCheckin(patientId, deviceId);
      
      if (!removed) {
        res.status(404).json({
          errors: [{
            status: '404',
            code: 'CHECKIN_NOT_FOUND',
            title: 'Check-in Not Found',
            detail: 'No saved check-in found for the provided patient ID and device'
          }]
        });
        return;
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error removing saved check-in:', error);
      res.status(500).json({
        errors: [{
          status: '500',
          code: 'INTERNAL_ERROR',
          title: 'Internal Server Error',
          detail: 'Failed to remove saved check-in'
        }]
      });
    }
  }
}