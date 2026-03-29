const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');

router.post('/health', authCtrl.health);
router.post('/login', authCtrl.login);
router.post('/token', authCtrl.token); // Pour obtenir un nouvel Access Token
router.delete('/logout', authCtrl.logout);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/reset-password', authCtrl.resetPassword);

module.exports = router;