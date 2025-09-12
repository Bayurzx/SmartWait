// apps\api\src\routes\checkin-history.ts
import { Router } from 'express';
import { CheckinHistoryController } from '../controllers/checkin-history-controller';

const router = Router();
const checkinHistoryController = new CheckinHistoryController();

/**
 * @route GET /api/v1/checkin-history
 * @desc Get saved check-ins for a device
 * @query deviceId - Device identifier
 */
router.get('/', (req, res) => checkinHistoryController.getSavedCheckins(req, res));

/**
 * @route POST /api/v1/checkin-history
 * @desc Save a check-in for future reference
 * @body patientId, deviceId, patientName?, facilityName?
 */
router.post('/', (req, res) => checkinHistoryController.saveCheckin(req, res));

/**
 * @route DELETE /api/v1/checkin-history/:patientId
 * @desc Remove a saved check-in
 * @param patientId - Patient ID to remove
 * @query deviceId - Device identifier
 */
router.delete('/:patientId', (req, res) => checkinHistoryController.removeSavedCheckin(req, res));

export default router;