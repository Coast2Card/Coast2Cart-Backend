# Seller Account Creation - Quick Start

## Two Different Flows

### Flow 1: Self-Registration (Digital Literate Seller)

- Seller creates account via `/api/auth/signup` with `role: "seller"`
- Seller verifies OTP themselves via `/api/auth/verify-otp`
- Status: `isVerified: true`, `sellerApprovalStatus: "pending"`
- **Admin must approve** before seller can login

### Flow 2: Admin-Assisted (Digital Illiterate Seller) ⭐ THIS GUIDE

- **Admin creates account** via `/api/accounts/seller`
- **Admin inputs OTP** (from seller) via `/api/accounts/seller/verify-otp`
- Status: `isVerified: true`, `sellerApprovalStatus: "approved"` (auto-approved!)
- **Seller can login immediately** - no approval needed

---

## Admin-Assisted Seller Account Creation

### Step 1: Admin Creates Seller Account

**Endpoint:**

```
POST http://localhost:5000/api/accounts/seller
```

**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Body (Your Example):**

```json
{
  "firstName": "Mr.",
  "lastName": "Big",
  "username": "biggerboyrapi",
  "dateOfBirth": "2004-11-27",
  "contactNo": "9154903863",
  "address": "Sampaloc, Manila",
  "password": "Testing@123",
  "confirmPassword": "Testing@123"
}
```

**Note:** Email is **optional** (can be omitted) since not all sellers are digital literate. Phone number (`contactNo`) is the **required unique identifier**.

**Expected Response:**

```json
{
  "success": true,
  "message": "Seller account created successfully. An OTP has been sent to the seller's phone number for verification.",
  "data": {
    "sellerId": "67xxxxx",
    "firstName": "Mr.",
    "lastName": "Big",
    "username": "biggerboyrapi",
    "email": "rapi.test@gmail.com",
    "contactNo": "9154903863",
    "role": "seller",
    "isVerified": false,
    "sellerApprovalStatus": "pending",
    "createdAt": "2025-10-14T...",
    "smsSent": true
  }
}
```

**What Happens:**

1. ✅ Seller account is created (email is optional - can be omitted)
2. 📱 OTP is sent to `9154903863` (phone number is the unique identifier)
3. 📝 Account status: `isVerified: false`, `sellerApprovalStatus: "pending"`
4. ⏳ Waiting for admin to input OTP from seller

---

### Step 2: Admin Verifies OTP (from Seller)

**In your modal:** Keep it open, show OTP input field, seller gives OTP to admin

**Endpoint:**

```
POST http://localhost:5000/api/accounts/seller/verify-otp
```

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your_admin_token>
```

**Body:**

```json
{
  "sellerId": "67xxxxx",
  "otp": "123456"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Seller account verified and approved successfully. The seller can now login.",
  "data": {
    "seller": {
      "id": "67xxxxx",
      "firstName": "Mr.",
      "lastName": "Big",
      "username": "biggerboyrapi",
      "email": "rapi.test@gmail.com",
      "contactNo": "9154903863",
      "role": "seller",
      "isVerified": true,
      "sellerApprovalStatus": "approved",
      "approvedBy": "67yyyyy",
      "approvedAt": "2025-10-14T..."
    }
  }
}
```

**What Happens:**

1. ✅ Phone number verified
2. ✅ Account **automatically approved** (since admin created it)
3. 📝 Account status: `isVerified: true`, `sellerApprovalStatus: "approved"`
4. 🎉 Seller can login immediately!

**Note:** No approval step needed! Admin-created accounts are auto-approved.

---

### Step 3: Seller Logs In (Immediately!)

**Endpoint:**

```
POST http://localhost:5000/api/auth/login
```

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "identifier": "biggerboyrapi",
  "password": "Testing@123"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "67xxxxx",
      "firstName": "Mr.",
      "lastName": "Big",
      "username": "biggerboyrapi",
      "email": "rapi.test@gmail.com",
      "contactNo": "9154903863",
      "role": "seller",
      "isVerified": true
    }
  }
}
```

**What Happens:**

1. ✅ Seller logged in
2. 🔑 JWT token received
3. 🎉 Seller can access the platform!

---

## Testing Tips

### Get OTP from Server Logs

If PhilSMS is not configured, check your server console for:

```
📱 PhilSMS not configured - OTP would be: 123456
```

### Common Issues

**❌ "Insufficient permissions"**

- Make sure you're using an admin/superadmin token

**❌ "Username already exists"**

- Use a different username

**❌ "Invalid or expired OTP"**

- OTP expires after 5 minutes
- Request a new OTP using `POST /api/auth/resend-otp`

**❌ "Account not verified"** (during login)

- Seller must verify OTP first

**❌ "Your seller account is pending approval"** (during login)

- This only happens for self-registered sellers
- Admin-created sellers are auto-approved

---

## Quick Test with cURL

```bash
# Step 1: Admin creates seller account
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
    "password": "Testing@123",
    "confirmPassword": "Testing@123"
  }'
# Response includes sellerId - save it!

# Step 2: Admin verifies OTP (from seller)
curl -X POST http://localhost:5000/api/accounts/seller/verify-otp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "sellerId": "67xxxxx",
    "otp": "123456"
  }'
# Account is now APPROVED automatically!

# Step 3: Seller logs in immediately
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "biggerboyrapi",
    "password": "Testing@123"
  }'
```

---

## Postman Collection

Import these requests into Postman:

1. **Create Seller** - POST `{{BASE_URL}}/accounts/seller`
2. **Verify OTP** - POST `{{BASE_URL}}/auth/verify-otp`
3. **Get Pending Sellers** - GET `{{BASE_URL}}/accounts/sellers/pending`
4. **Approve Seller** - PUT `{{BASE_URL}}/accounts/sellers/:sellerId/approval`
5. **Login** - POST `{{BASE_URL}}/auth/login`

Set environment variable: `BASE_URL = http://localhost:5000/api`

---

## That's It! 🎉

**Admin-Assisted Flow (Digital Illiterate Sellers):**

1. Admin creates seller account ✅
2. OTP is sent to seller's phone ✅
3. Admin inputs OTP (from seller) ✅
4. Account **auto-approved** ✅
5. Seller can login immediately ✅

**Key Difference:**

- Self-registered sellers → need admin approval
- Admin-created sellers → auto-approved after OTP

For more details, see `SELLER_ACCOUNT_CREATION_GUIDE.md`
