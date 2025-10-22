# API Routes Documentation

Base URL: `http://localhost:5000/api`

---

## Authentication Routes

### 1. User Signup
**POST** `/auth/signup`

**Access:** Public

**Description:** Register a new user with optional referral code

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "referral_code": "a1b2c3d4 (optional - 8-character hex code)"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "JWT_TOKEN",
  "user": {
    "_id": "userId",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "balance": 0,
    "direct_income": 0,
    "passive_income": 0,
    "referral_code": "a1b2c3d4",
    "referral_of": "referrerId or null",
    "status": "pending",
    "plan": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- 400: Email already registered
- 400: Invalid referral code
- 500: Server error

---

### 2. User Login
**POST** `/auth/login`

**Access:** Public

**Description:** Login with email and password

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "JWT_TOKEN",
  "user": {
    "_id": "userId",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "balance": 0,
    "direct_income": 0,
    "passive_income": 0,
    "referral_code": "a1b2c3d4",
    "referral_of": "referrerId or null",
    "status": "pending",
    "plan": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- 401: Invalid credentials
- 500: Server error

---

### 3. Forgot Password
**POST** `/auth/forgot`

**Access:** Public

**Description:** Send password reset email with reset link

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Error Responses:**
- 404: No user found with that email
- 500: Email could not be sent
- 500: Server error

---

### 4. Reset Password
**POST** `/auth/reset/:id/:token`

**Access:** Public

**Description:** Reset password using the token from email

**URL Parameters:**
- `id`: User ID
- `token`: Reset token from email

**Request Body:**
```json
{
  "password": "newPassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful",
  "token": "JWT_TOKEN"
}
```

**Error Responses:**
- 400: Invalid or expired reset token
- 500: Server error

---

## User Routes

### 5. Get All Users
**GET** `/users`

**Access:** Private (Admin only)

**Description:** Get all users with pagination and statistics

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Example Request:**
```
GET /api/users?page=1&limit=10
```

**Success Response (200):**
```json
{
  "success": true,
  "count": 10,
  "total": 47,
  "page": 1,
  "pages": 5,
  "users": [
    {
      "_id": "userId",
      "name": "John Doe",
      "email": "john@example.com",
      "totalReferrals": 5,
      "totalIncome": 150
    }
  ]
}
```

**Error Responses:**
- 401: Not authorized
- 403: User role is not authorized (admin only)
- 500: Server error

---

### 6. Get Current User
**GET** `/me`

**Access:** Private (JWT required)

**Description:** Get current user data with referrals grouped by plan

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "userId",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "balance": 100,
    "direct_income": 50,
    "passive_income": 50,
    "referral_code": "a1b2c3d4",
    "referral_of": {
      "_id": "referrerId",
      "name": "Referrer Name",
      "email": "referrer@example.com"
    },
    "status": "active",
    "plan": "learnic",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "referrals": {
    "knowic_referrals": [
      {
        "name": "User 1",
        "joinDate": "2024-01-02T00:00:00.000Z"
      }
    ],
    "learnic_referrals": [
      {
        "name": "User 2",
        "joinDate": "2024-01-03T00:00:00.000Z"
      }
    ],
    "masteric_referrals": [],
    "total": 2
  }
}
```

**Error Responses:**
- 401: Not authorized
- 404: User not found
- 500: Server error

---

## Request Routes

### 7. Create Request
**POST** `/requests`

**Access:** Private (JWT required)

**Description:** Create a new approval request for a pending user with proof image upload

**Headers:**
```
Authorization: Bearer JWT_TOKEN
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
user_id: "pendingUserId" (required)
plan: "knowic" (required - knowic, learnic, or masteric)
proof_image: [File] (required - image file, max 5MB, formats: jpeg, jpg, png, gif, webp)
```

**File Upload Requirements:**
- Field name: `proof_image`
- Max file size: 5MB
- Allowed formats: jpeg, jpg, png, gif, webp
- Files stored in `/proofs` directory on server
- Accessible at: `http://localhost:5000/proofs/[filename]`

**Validation Rules:**
- Only referrer can create request for their referred user
- User with no referrer can create their own request (user_id === sender_id)
- User must be in "pending" status
- No pending request should already exist for the user
- Sender's plan must permit the selected plan (hierarchy rules)
- Plan must be one of: knowic, learnic, masteric
- Proof image file is required

**Success Response (201):**
```json
{
  "success": true,
  "message": "Request created successfully",
  "request": {
    "_id": "requestId",
    "user_id": {
      "_id": "userId",
      "name": "User Name",
      "email": "user@example.com"
    },
    "sender_id": {
      "_id": "senderId",
      "name": "Sender Name",
      "email": "sender@example.com"
    },
    "proof_image": "proofs/proof-1234567890-abc123.jpg",
    "status": "pending",
    "plan": "knowic",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- 400: Proof image is required
- 400: File size exceeds 5MB
- 400: Invalid file format (only images allowed)
- 400: User is not in pending status
- 400: A pending request already exists
- 400: Sender's plan does not allow referring this plan
- 403: Not authorized to create request for this user
- 404: User not found
- 500: Server error

---

### 8. Get All Requests
**GET** `/requests`

**Access:** Private (Admin only)

**Description:** Get all requests with pagination and status filter (for admin dashboard)

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status - "pending", "approved", "rejected", or "all" (default: "pending")

**Example Request:**
```
GET /api/requests?page=1&limit=5&status=pending
```

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "total": 23,
  "page": 1,
  "pages": 5,
  "requests": [
    {
      "_id": "requestId",
      "user_id": {
        "_id": "userId",
        "name": "User Name",
        "email": "user@example.com",
        "referral_code": "a1b2c3d4"
      },
      "sender_id": {
        "_id": "senderId",
        "name": "Sender Name",
        "email": "sender@example.com",
        "referral_code": "e5f6g7h8"
      },
      "proof_image": "proofs/proof-1234567890-abc123.jpg",
      "status": "pending",
      "plan": "knowic",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- 401: Not authorized
- 403: User role is not authorized (admin only)
- 500: Server error

---

### 9. Approve Request
**POST** `/requests/approve/:id`

**Access:** Private (Admin only)

**Description:** Approve a request and distribute income

**URL Parameters:**
- `id`: Request ID

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Business Logic:**
1. Updates request status to "approved"
2. Sets user status to "active" and assigns plan
3. Gives direct income to sender (referrer)
4. Creates direct transaction for sender
5. Gives passive income to sender's referrer (if exists)
6. Creates passive transaction for grand-referrer
7. All operations are performed in a MongoDB transaction

**Plan Pricing:**
- **Knowic:** Direct: $2, Passive: $16
- **Learnic:** Direct: $4, Passive: $40
- **Masteric:** Direct: $7, Passive: $85

**Success Response (200):**
```json
{
  "success": true,
  "message": "Request approved successfully",
  "request": {
    "_id": "requestId",
    "user_id": {
      "_id": "userId",
      "name": "User Name",
      "email": "user@example.com",
      "status": "active",
      "plan": "knowic"
    },
    "sender_id": {
      "_id": "senderId",
      "name": "Sender Name",
      "email": "sender@example.com"
    },
    "proof_image": "proofs/proof-1234567890-abc123.jpg",
    "status": "approved",
    "plan": "knowic",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- 400: Request has already been processed
- 401: Not authorized
- 403: User role is not authorized (admin only)
- 404: Request not found
- 500: Server error

---

### 10. Reject Request
**POST** `/requests/reject/:id`

**Access:** Private (Admin only)

**Description:** Reject and delete a pending request

**URL Parameters:**
- `id`: Request ID

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Request rejected and deleted successfully"
}
```

**Error Responses:**
- 400: Only pending requests can be rejected
- 401: Not authorized
- 403: User role is not authorized (admin only)
- 404: Request not found
- 500: Server error

---

## Transaction Routes

### 11. Get All Transactions
**GET** `/transactions`

**Access:** Private (Admin only)

**Description:** Get all transactions with pagination

**Headers:**
```
Authorization: Bearer JWT_TOKEN
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Example Request:**
```
GET /api/transactions?page=1&limit=10
```

**Success Response (200):**
```json
{
  "success": true,
  "count": 10,
  "total": 47,
  "page": 1,
  "pages": 5,
  "transactions": [
    {
      "_id": "transactionId",
      "type": "direct",
      "amount": 2,
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Transaction Types:**
- `direct`: Direct income from referrals
- `passive`: Passive income from sub-referrals
- `withdrawal`: Withdrawal transactions

**Error Responses:**
- 401: Not authorized
- 403: User role is not authorized (admin only)
- 500: Server error

---

## Plan Hierarchy Rules

Users can only refer users based on their plan level:

| User Plan | Can Refer Plans |
|-----------|----------------|
| Knowic    | Knowic only |
| Learnic   | Knowic, Learnic |
| Masteric  | Knowic, Learnic, Masteric |

---

## Authentication

All private routes require a JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

The token is returned upon successful signup or login.

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [] // Optional validation errors array
}
```

---

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Configurable via environment variables
- Response on limit exceeded: 429 Too Many Requests

---

## Notes

1. All monetary values are in USD
2. Balance is auto-calculated from transactions on `/me` calls
3. Users start as "pending" and become "active" upon request approval
4. Referral codes are 8-character hex strings, auto-generated and unique
5. Password reset tokens expire after 1 hour
6. All dates are in ISO 8601 format
