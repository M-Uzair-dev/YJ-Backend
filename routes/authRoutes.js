const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const {
  signupValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  validate,
} = require('../middleware/validators');

// @route   POST /api/auth/signup
router.post('/signup', signupValidation, validate, signup);

// @route   POST /api/auth/login
router.post('/login', loginValidation, validate, login);

// @route   POST /api/auth/forgot
router.post('/forgot', forgotPasswordValidation, validate, forgotPassword);

// @route   POST /api/auth/reset/:id/:token
router.post('/reset/:id/:token', resetPasswordValidation, validate, resetPassword);

module.exports = router;
