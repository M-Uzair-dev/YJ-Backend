require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const requestRoutes = require("./routes/requestRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const ebookRoutes = require("./routes/ebookRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const discountRoutes = require("./routes/discountRoutes");
const upgradeRequestRoutes = require("./routes/upgradeRequestRoutes");

// Import cron jobs
const { startLeaderboardJob } = require("./jobs/leaderboardJob");
const { startResetJobs } = require("./jobs/resetJobs");

// Initialize express app
const app = express();

// Set server timeout for large file uploads (10 minutes)
app.timeout = 600000; // 10 minutes in milliseconds

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable CSP to allow images to load
  })
); // Security headers

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://www.yjnetwork.net',
  'https://yjnetwork.net',
  'https://referralapp.uzairmanan.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions)); // CORS with proper configuration

// Explicitly handle OPTIONS requests for preflight
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '100mb' })); // Body parser with increased limit
app.use(express.urlencoded({ extended: true, limit: '100mb' })); // URL encoded data with increased limit
app.use(morgan("dev")); // Logging

// Serve static files from proofs directory
app.use("/proofs", express.static(path.join(__dirname, "proofs")));

// Serve static files from ebooks directory
app.use("/ebooks", express.static(path.join(__dirname, "ebooks")));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max:
    process.env.NODE_ENV === "development"
      ? 500
      : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log(" MongoDB connected successfully"))
  .catch((err) => {
    console.error("L MongoDB connection error:", err);
    process.exit(1);
  });

// Health check route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Referral App API is running",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api", withdrawRoutes);
app.use("/api/ebooks", ebookRoutes);
app.use("/api", leaderboardRoutes);
app.use("/api", discountRoutes);
app.use("/api/upgrade-requests", upgradeRequestRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`=� Server running on port ${PORT}`);
  console.log(`=� Environment: ${process.env.NODE_ENV || "development"}`);

  // Start cron jobs after server is running
  startLeaderboardJob();
  startResetJobs();
  console.log(" Leaderboard cron jobs started successfully");
});

// Set timeout on the server instance for large file uploads (10 minutes)
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 610000; // Slightly higher than timeout
server.headersTimeout = 620000; // Slightly higher than keepAliveTimeout

console.log(" Server timeout set to 10 minutes for large file uploads");

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("L Unhandled Rejection:", err);
  process.exit(1);
});
