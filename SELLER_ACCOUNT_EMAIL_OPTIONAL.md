# Email is Optional for Seller Accounts

## Change Summary

Email is now **optional** for seller account creation, especially for digital illiterate sellers who may not have email addresses.

## Why This Change?

Many sellers, particularly those who are not digitally literate, may not have email addresses. The phone number serves as the primary and unique identifier for these sellers.

## What Changed

### 1. Account Model (`backend/models/Accounts.js`)

```javascript
email: {
  type: String,
  lowercase: true,
  unique: true,
  sparse: true,  // ← Allows multiple null values
  required: false,  // ← Email is now optional
  match: [
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    "Please provide a valid email",
  ],
}
```

**Key Points:**

- `required: false` - Email is not mandatory
- `sparse: true` - Allows multiple documents with `null` email (prevents unique constraint error)

### 2. Controller (`backend/controllers/accountController.js`)

**Email validation only if provided:**

```javascript
// Check if email already exists (only if email is provided)
if (email) {
  const existingEmail = await Account.findOne({
    email: email.toLowerCase(),
  });
  if (existingEmail) {
    throw new ConflictError("Email already exists");
  }
}
```

**Email included only if provided:**

```javascript
const sellerData = {
  firstName,
  lastName,
  username: username.toLowerCase(),
  dateOfBirth,
  contactNo: normalizedContact,
  address,
  ...(email && { email: email.toLowerCase() }), // Email is optional
  password,
  role: "seller",
  isVerified: false,
  // ...
};
```

**Phone number validation strengthened:**

```javascript
const normalizedContact = philsmsService.normalizePhContact(contactNo);
if (!normalizedContact || normalizedContact.length !== 10) {
  throw new BadRequestError(
    "Valid contact number is required (10 digits starting with 9)"
  );
}
```

## Updated Request Format

### Required Fields Only:

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

### With Optional Email:

```json
{
  "firstName": "Mr.",
  "lastName": "Big",
  "username": "biggerboyrapi",
  "dateOfBirth": "2004-11-27",
  "contactNo": "9154903863",
  "address": "Sampaloc, Manila",
  "email": "optional@example.com",
  "password": "Testing@123",
  "confirmPassword": "Testing@123"
}
```

## Unique Identifiers

### Primary (Required):

- ✅ **Phone Number (`contactNo`)** - Must be unique, 10 digits starting with 9
- ✅ **Username** - Must be unique

### Secondary (Optional):

- ⚠️ **Email** - If provided, must be unique. Can be null/omitted.

## Impact on Existing Features

### Login

Sellers can login using:

1. **Username** ✅
2. **Phone Number** ✅
3. **Email** ✅ (if they provided one during registration)

### OTP Verification

- Still uses phone number (unchanged)
- Phone number is the primary communication channel

### Account Recovery

- For sellers without email, phone number is the only recovery method
- Password reset would need to use phone number OTP

## Database Considerations

The `sparse: true` option on the email field ensures that:

- Multiple seller accounts can exist with `null` email
- The unique constraint still applies to non-null emails
- No conflicts when creating accounts without email

## Testing

**Create seller without email:**

```bash
curl -X POST http://localhost:5000/api/accounts/seller \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "username": "juan_seller",
    "dateOfBirth": "1990-01-01",
    "contactNo": "9123456789",
    "address": "Manila",
    "password": "Password123!",
    "confirmPassword": "Password123!"
  }'
```

**Expected:** ✅ Success - account created without email

**Create multiple sellers without email:**

```bash
# First seller without email
POST /api/accounts/seller
{ ..., "contactNo": "9123456789", /* no email */ }

# Second seller without email
POST /api/accounts/seller
{ ..., "contactNo": "9987654321", /* no email */ }
```

**Expected:** ✅ Both succeed - sparse index allows multiple null emails

## Backward Compatibility

✅ **Fully backward compatible**

- Existing accounts with email are unaffected
- New accounts can still include email if desired
- Only new seller accounts created by admin can omit email

## Summary

| Feature                         | Before                   | After                                |
| ------------------------------- | ------------------------ | ------------------------------------ |
| Email Required                  | ✅ Yes                   | ❌ No (Optional)                     |
| Unique Identifier               | Username + Email + Phone | Username + Phone (Email optional)    |
| Can create without email        | ❌ No                    | ✅ Yes                               |
| Multiple accounts without email | ❌ No                    | ✅ Yes                               |
| Login methods                   | Username, Email, Phone   | Username, Email (if provided), Phone |

---

**Implementation Date:** October 14, 2025  
**Status:** ✅ Complete  
**Breaking Changes:** None  
**Migration Required:** No
