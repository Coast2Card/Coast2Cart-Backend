# Seller Account Creation Guide (Admin-Initiated)

This guide explains the flow for admin-initiated seller account creation in the Coast2Cart platform.

## Overview

The seller account creation flow involves two main steps:

1. **Admin creates the seller account** - The admin provides all necessary details and the system sends an OTP to the seller's phone number
2. **Seller verifies the account via OTP** - The seller receives the OTP and verifies their phone number to activate the account

After verification, the seller account will have a "pending" approval status and will need to be reviewed and approved by an admin before the seller can log in and access the platform.

---

## Step 1: Admin Creates Seller Account

### Endpoint

```
POST /api/accounts/seller
```

### Authentication

- **Required**: Bearer token (Admin or Superadmin role)
- **Authorization Header**: `Authorization: Bearer <admin_token>`

### Request Body

**Content-Type**: `application/json` (or `multipart/form-data` if including profile picture)

**Required Fields**:

```json
{
  "firstName": "Mr.",
  "lastName": "Big",
  "username": "biggerboyrapi",
  "dateOfBirth": "2004-11-27",
  "contactNo": "9154903863",
  "address": "Sampaloc, Manila",
  "email": "rapi.test@gmail.com",
  "password": "Testing@123",
  "confirmPassword": "Testing@123"
}
```

**Optional Fields**:

- `profilePicture` (file) - Profile picture image (multipart/form-data only)

### Field Validations

| Field             | Type   | Validation Rules                                              |
| ----------------- | ------ | ------------------------------------------------------------- |
| `firstName`       | String | Required, trimmed                                             |
| `lastName`        | String | Required, trimmed                                             |
| `username`        | String | Required, unique, lowercase, trimmed                          |
| `dateOfBirth`     | Date   | Required, must be 18+ years old                               |
| `contactNo`       | String | Required, unique, must be valid PH number (9XXXXXXXXX format) |
| `address`         | String | Required, trimmed                                             |
| `email`           | String | Required, unique, valid email format, lowercase               |
| `password`        | String | Required, minimum 8 characters                                |
| `confirmPassword` | String | Required, must match password                                 |

### Contact Number Format

The contact number should be in one of these formats (will be normalized automatically):

- `9154903863` (10 digits starting with 9) ✅ Recommended
- `09154903863` (11 digits with leading 0)
- `639154903863` (12 digits with country code)
- `+639154903863` (with + prefix)

### Success Response

**Status Code**: `201 Created`

```json
{
  "success": true,
  "message": "Seller account created successfully. An OTP has been sent to the seller's phone number for verification.",
  "data": {
    "sellerId": "507f1f77bcf86cd799439011",
    "firstName": "Mr.",
    "lastName": "Big",
    "username": "biggerboyrapi",
    "email": "rapi.test@gmail.com",
    "contactNo": "9154903863",
    "role": "seller",
    "isVerified": false,
    "sellerApprovalStatus": "pending",
    "createdAt": "2025-10-14T10:30:00.000Z",
    "smsSent": true
  }
}
```

### Error Responses

**Status Code**: `400 Bad Request`

```json
{
  "success": false,
  "message": "Passwords do not match"
}
```

**Status Code**: `409 Conflict`

```json
{
  "success": false,
  "message": "Username already exists"
}
```

or

```json
{
  "success": false,
  "message": "Email already exists"
}
```

or

```json
{
  "success": false,
  "message": "Contact number already exists"
}
```

**Status Code**: `401 Unauthorized`

```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### Example cURL Request

```bash
curl -X POST http://localhost:5000/api/accounts/seller \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "firstName": "Mr.",
    "lastName": "Big",
    "username": "biggerboyrapi",
    "dateOfBirth": "2004-11-27",
    "contactNo": "9154903863",
    "address": "Sampaloc, Manila",
    "email": "rapi.test@gmail.com",
    "password": "Testing@123",
    "confirmPassword": "Testing@123"
  }'
```

---

## Step 2: Seller Verifies Account via OTP

### Endpoint

```
POST /api/auth/verify-otp
```

### Authentication

- **Required**: None (public endpoint)

### Request Body

**Content-Type**: `application/json`

```json
{
  "otp": "123456",
  "contactNo": "9154903863"
}
```

### Field Details

| Field       | Type   | Description                                 |
| ----------- | ------ | ------------------------------------------- |
| `otp`       | String | 6-digit OTP code sent to the seller's phone |
| `contactNo` | String | Phone number in any valid format            |

### OTP Expiration

- OTP is valid for **5 minutes** from generation
- After expiration, seller must request a new OTP using the resend endpoint

### Success Response

**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "Account verified successfully. Your seller account will be reviewed by an administrator.",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Mr.",
      "lastName": "Big",
      "username": "biggerboyrapi",
      "email": "rapi.test@gmail.com",
      "contactNo": "9154903863",
      "role": "seller",
      "isVerified": true
    },
    "sellerApprovalStatus": "pending"
  }
}
```

**Note**: Unlike buyer accounts, seller accounts do **NOT** receive a JWT token upon verification. They must wait for admin approval before they can log in.

### Error Responses

**Status Code**: `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

**Status Code**: `404 Not Found`

```json
{
  "success": false,
  "message": "Account not found with this contact number"
}
```

### Example cURL Request

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "otp": "123456",
    "contactNo": "9154903863"
  }'
```

---

## Step 3: Resend OTP (If Needed)

If the seller doesn't receive the OTP or it expires, they can request a new one.

### Endpoint

```
POST /api/auth/resend-otp
```

### Authentication

- **Required**: None (public endpoint)

### Request Body

**Content-Type**: `application/json`

```json
{
  "contactNo": "9154903863"
}
```

### Rate Limiting

- OTP can only be resent after the previous OTP expires (5 minutes)
- If attempting to resend before expiration, you'll receive an error with remaining seconds

### Success Response

**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "OTP resent successfully",
  "smsSent": true
}
```

### Error Responses

**Status Code**: `429 Too Many Requests`

```json
{
  "success": false,
  "message": "Please wait 180 seconds before requesting a new OTP"
}
```

---

## Step 4: Admin Approves Seller Account

After the seller verifies their account, an admin must approve them before they can log in.

### Endpoint

```
PUT /api/accounts/sellers/:sellerId/approval
```

### Authentication

- **Required**: Bearer token (Admin or Superadmin role)

### Request Body

```json
{
  "status": "approved"
}
```

**Valid Status Values**: `"approved"` or `"rejected"`

### Success Response

**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "Seller account approved successfully",
  "data": {
    "seller": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Mr.",
      "lastName": "Big",
      "username": "biggerboyrapi",
      "email": "rapi.test@gmail.com",
      "sellerApprovalStatus": "approved",
      "approvedBy": "507f1f77bcf86cd799439012",
      "approvedAt": "2025-10-14T10:45:00.000Z"
    }
  }
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SELLER ACCOUNT CREATION                   │
└─────────────────────────────────────────────────────────────┘

   ┌────────┐
   │ Admin  │
   └───┬────┘
       │
       │ 1. POST /api/accounts/seller
       │    (with seller details)
       │
       ▼
   ┌────────────────────┐
   │  Backend Server    │
   │  - Creates account │     ┌─────────────┐
   │  - Generates OTP   │────▶│  PhilSMS    │
   │  - isVerified=false│     │  (Send OTP) │
   └─────────┬──────────┘     └─────────────┘
             │
             │ Returns sellerId & status
             │
             ▼
        ┌────────┐
        │ Admin  │ (Informs seller to check phone)
        └────────┘

             │
             ▼
        ┌────────┐
        │ Seller │ (Receives OTP via SMS)
        └───┬────┘
            │
            │ 2. POST /api/auth/verify-otp
            │    (otp + contactNo)
            │
            ▼
   ┌────────────────────┐
   │  Backend Server    │
   │  - Validates OTP   │
   │  - isVerified=true │
   │  - status=pending  │
   └─────────┬──────────┘
             │
             │ Account verified
             │
             ▼
        ┌────────┐
        │ Seller │ (Waits for approval)
        └────────┘

             │
             ▼
        ┌────────┐
        │ Admin  │ (Reviews pending sellers)
        └───┬────┘
            │
            │ 3. PUT /api/accounts/sellers/:id/approval
            │    (status: "approved")
            │
            ▼
   ┌────────────────────┐
   │  Backend Server    │
   │  - Updates status  │
   │  - status=approved │
   └─────────┬──────────┘
             │
             │ Seller approved
             │
             ▼
        ┌────────┐
        │ Seller │ (Can now login)
        └────────┘
```

---

## Account States

A seller account goes through these states:

1. **Created (Unverified)**

   - `isVerified: false`
   - `sellerApprovalStatus: "pending"`
   - Cannot login

2. **Verified (Pending Approval)**

   - `isVerified: true`
   - `sellerApprovalStatus: "pending"`
   - Cannot login (needs admin approval)

3. **Approved**

   - `isVerified: true`
   - `sellerApprovalStatus: "approved"`
   - Can login

4. **Rejected**
   - `isVerified: true`
   - `sellerApprovalStatus: "rejected"`
   - Cannot login

---

## Testing Notes

### Development/Testing Environment

If PhilSMS is not configured (missing environment variables):

- The OTP will be logged to the console instead of sent via SMS
- `smsSent` will be `false` in the response
- Check server logs for the OTP code

### Required Environment Variables

```env
PHILSMS_API_KEY=your_api_key
PHILSMS_API_URL=https://app.philsms.com/api
PHILSMS_SENDER_ID=your_sender_id
```

---

## Troubleshooting

### Common Issues

1. **"Contact number already exists"**

   - Check if a seller with this number already exists
   - Use the GET /api/accounts endpoint to search for existing accounts

2. **"OTP not received"**

   - Check server logs for SMS sending errors
   - Verify PhilSMS configuration
   - Use resend OTP endpoint

3. **"Invalid or expired OTP"**

   - OTP expires after 5 minutes
   - Request a new OTP using the resend endpoint
   - Ensure the OTP code is entered correctly (6 digits)

4. **"Account not verified"**
   - Seller must verify OTP before admin approval
   - Check `isVerified` status in the account record

---

## Security Considerations

1. **OTP Expiration**: OTPs expire after 5 minutes for security
2. **Rate Limiting**: OTP resend is rate-limited to prevent abuse
3. **Password Requirements**: Minimum 8 characters
4. **Phone Verification**: Ensures seller has access to the phone number
5. **Admin Approval**: Additional layer of verification before seller access

---

## Related Endpoints

- `GET /api/accounts/sellers/pending` - View all pending seller approvals
- `GET /api/accounts?role=seller` - View all seller accounts
- `POST /api/auth/login` - Login endpoint (after approval)
