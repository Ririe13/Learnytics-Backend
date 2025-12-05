const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');
const insightsController = require('../controllers/insightController');

router.get('/data/sample', dataController.getSample);
router.post('/data/import', dataController.importData);
router.get('/records', dataController.getRecords);
router.get('/insights/summary', insightsController.getSummary);
router.get('/insights/student/:studentId', insightsController.getStudentDetail);
router.get('/insights/leaderboard', insightsController.getLeaderboard);
router.get('/ml/recommendation/:studentId', insightsController.getRecommendation);

module.exports = router;
