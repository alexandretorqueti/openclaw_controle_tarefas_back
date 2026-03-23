import express from 'express';
const router = express.Router();
const stageController = require('../controllers/stageController');

router.get('/', stageController.getAll);
router.get('/:id', stageController.getById);
router.post('/', stageController.create);
router.put('/:id', stageController.update);
router.delete('/:id', stageController.delete);

module.exports = router;