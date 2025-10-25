require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const requestRoutes = require('./routes/requestRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const withdrawRoutes = require('./routes/withdrawRoutes');
const ebookRoutes = require('./routes/ebookRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

// Import cron jobs
const { startLeaderboardJob } = require('./jobs/leaderboardJob');
const { startResetJobs } = require('./jobs/resetJobs');

// Initialize express app
const app = express();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable CSP to allow images to load
  })
); // Security headers
app.use(cors({ origin: '*' })); // CORS - Allow all origins
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true })); // URL encoded data
app.use(morgan('dev')); // Logging

// Serve static files from proofs directory
app.use('/proofs', express.static(path.join(__dirname, 'proofs')));

// Serve static files from ebooks directory
app.use('/ebooks', express.static(path.join(__dirname, 'ebooks')));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log(' MongoDB connected successfully'))
  .catch((err) => {
    console.error('L MongoDB connection error:', err);
    process.exit(1);
  });

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Referral App API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api', withdrawRoutes);
app.use('/api/ebooks', ebookRoutes);
app.use('/api', leaderboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`=� Server running on port ${PORT}`);
  console.log(`=� Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start cron jobs after server is running
  startLeaderboardJob();
  startResetJobs();
  console.log(' Leaderboard cron jobs started successfully');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('L Unhandled Rejection:', err);
  process.exit(1);
});
