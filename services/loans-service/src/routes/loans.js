const express = require('express');
const router = express.Router();
const {
  getAllLoans,
  getLoanHistory,
  getOverdueLoans,
  getLoansByUser,
  getLoanById,
  createLoan,
  returnLoan,
} = require('../controllers/loansController');
const authenticateToken = require('../security/auth.middleware');

//router.use(authenticateToken);

router.get('/history', getLoanHistory);
router.get('/overdue', getOverdueLoans);
router.get('/user/:userId', getLoansByUser);
router.get('/', getAllLoans);
router.get('/:id', getLoanById);
router.post('/', createLoan);
router.put('/:id/return', returnLoan);

module.exports = router;
