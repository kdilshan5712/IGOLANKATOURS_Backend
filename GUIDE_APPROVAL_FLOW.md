# Tour Guide Authentication & Approval Flow - API Documentation

## ✅ Implementation Complete

The tour guide authentication lifecycle has been fully implemented with admin approval flow, following an Uber-style onboarding process.

---

## 🔄 Complete Guide Lifecycle

```
1. Guide Registration → POST /api/guides/register
   ↓
2. Upload Documents → POST /api/guides/documents (requires auth)
   ↓
3. Admin Reviews → GET /api/admin/guides/pending
   ↓
4a. Admin Approves → PATCH /api/admin/guides/:guideId/approve
   OR
4b. Admin Rejects → PATCH /api/admin/guides/:guideId/reject
   ↓
5. Guide Login → POST /api/auth/login (only if approved)
   ↓
6. Access Dashboard → GET /api/guides/dashboard
```

---

## 📋 API Endpoints

### **1. Guide Registration** ✅
**Endpoint:** `POST /api/guides/register`  
**Access:** Public  
**Purpose:** Create new tour guide account

**Request Body:**
```json
{
  "email": "guide@example.com",
  "password": "StrongP@ss123",
  "full_name": "John Smith",
  "contact_number": "+94 71 234 5678"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

**Response (201):**
```json
{
  "message": "Guide registered. Upload documents to continue.",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Database Changes:**
- Creates user with `role = 'guide'` and `status = 'pending'`
- Creates tour_guide record with `approved = false`
- Sends registration confirmation email

---

### **2. Upload Guide Documents** ✅
**Endpoint:** `POST /api/guides/documents`  
**Access:** Authenticated Guide Only  
**Purpose:** Upload verification documents (license, ID, certificates)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
```
document: <file> (PDF, JPG, PNG)
document_type: "license" | "certificate" | "id_card" | "other"
```

**Response (201):**
```json
{
  "message": "Document uploaded successfully. Awaiting admin verification.",
  "document": {
    "document_type": "license",
    "document_url": "guide_123/1642512345_license.pdf",
    "verified": false
  }
}
```

**Rules:**
- Guide must not be already approved
- Each document type can only be uploaded once
- Files stored in Supabase Storage bucket `guide-documents`
- Sends notification email to guide

---

### **3. Get Guide Profile** ✅ NEW
**Endpoint:** `GET /api/guides/me`  
**Access:** Authenticated Guide Only  
**Purpose:** Retrieve guide profile with documents

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "guide_id": 123,
  "full_name": "John Smith",
  "contact_number": "+94 71 234 5678",
  "email": "guide@example.com",
  "approved": false,
  "status": "pending",
  "email_verified": true,
  "documents": [
    {
      "document_id": 456,
      "document_type": "license",
      "document_url": "guide_123/1642512345_license.pdf",
      "verified": false,
      "uploaded_at": "2026-01-18T10:30:00Z"
    },
    {
      "document_id": 457,
      "document_type": "id_card",
      "document_url": "guide_123/1642512456_id.jpg",
      "verified": false,
      "uploaded_at": "2026-01-18T10:35:00Z"
    }
  ]
}
```

---

### **4. Guide Dashboard** ✅ NEW
**Endpoint:** `GET /api/guides/dashboard`  
**Access:** Authenticated Active Guide Only  
**Purpose:** Dashboard access with statistics

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Dashboard access granted",
  "guide": {
    "guide_id": 123,
    "full_name": "John Smith",
    "approved": true,
    "status": "active"
  },
  "stats": {
    "verified_documents": 2,
    "pending_documents": 0
  }
}
```

**Response (403) - If Not Active:**
```json
{
  "message": "Dashboard access restricted. Account not active.",
  "status": "pending"
}
```

---

### **5. Guide Login** ✅
**Endpoint:** `POST /api/auth/login`  
**Access:** Public  
**Purpose:** Authenticate guide and issue JWT

**Request Body:**
```json
{
  "email": "guide@example.com",
  "password": "StrongP@ss123"
}
```

**Response (200) - Success:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 789,
    "email": "guide@example.com",
    "role": "guide",
    "email_verified": true
  }
}
```

**Response (403) - Pending Approval:**
```json
{
  "message": "Guide account pending admin approval. Please wait for verification."
}
```

**Response (403) - Rejected:**
```json
{
  "message": "Account has been rejected. Please contact support."
}
```

**Login Rules:**
- ✅ Password must match
- ✅ If role = 'guide' and status = 'pending' → BLOCKED
- ✅ If status = 'rejected' → BLOCKED
- ✅ If status = 'active' → ALLOWED
- ✅ Returns JWT token only for active guides

---

## 🛡️ Admin Endpoints

### **6. Get Pending Guides** ✅
**Endpoint:** `GET /api/admin/guides/pending`  
**Access:** Admin Only  
**Purpose:** List all guides awaiting approval

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "count": 2,
  "guides": [
    {
      "guide_id": 123,
      "user_id": 789,
      "email": "guide1@example.com",
      "full_name": "John Smith",
      "contact_number": "+94 71 234 5678",
      "status": "pending",
      "approved": false
    },
    {
      "guide_id": 124,
      "user_id": 790,
      "email": "guide2@example.com",
      "full_name": "Jane Doe",
      "contact_number": "+94 77 345 6789",
      "status": "pending",
      "approved": false
    }
  ]
}
```

---

### **7. Get Guide Documents** ✅
**Endpoint:** `GET /api/admin/guides/:guideId/documents`  
**Access:** Admin Only  
**Purpose:** View all documents for a specific guide

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "guide_id": 123,
  "count": 2,
  "documents": [
    {
      "document_id": 456,
      "document_type": "license",
      "document_url": "guide_123/1642512345_license.pdf",
      "verified": false,
      "uploaded_at": "2026-01-18T10:30:00Z"
    },
    {
      "document_id": 457,
      "document_type": "id_card",
      "document_url": "guide_123/1642512456_id.jpg",
      "verified": false,
      "uploaded_at": "2026-01-18T10:35:00Z"
    }
  ]
}
```

---

### **8. Approve Guide** ✅
**Endpoint:** `PATCH /api/admin/guides/:guideId/approve`  
**Alternative:** `POST /api/admin/guides/:guideId/approve` (backward compatible)  
**Access:** Admin Only  
**Purpose:** Approve guide and activate account

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "message": "Guide approved successfully"
}
```

**Database Changes:**
- ✅ Sets `tour_guide.approved = true`
- ✅ Sets `users.status = 'active'`
- ✅ Marks all documents as `verified = true`
- ✅ Sends approval email to guide

**Business Rules:**
- Guide must exist
- Guide must not be already approved
- Guide must have at least one document
- Uses database transaction for consistency

---

### **9. Reject Guide** ✅
**Endpoint:** `PATCH /api/admin/guides/:guideId/reject`  
**Alternative:** `POST /api/admin/guides/:guideId/reject` (backward compatible)  
**Access:** Admin Only  
**Purpose:** Reject guide application

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request Body (Optional):**
```json
{
  "reason": "Documents are not clear. Please resubmit."
}
```

**Response (200):**
```json
{
  "message": "Guide rejected successfully",
  "reason": "Documents are not clear. Please resubmit."
}
```

**Database Changes:**
- ✅ Sets `users.status = 'rejected'`
- ✅ Keeps `tour_guide.approved = false`
- ✅ Documents remain in storage (not deleted)
- ✅ Sends rejection email with reason

**Business Rules:**
- Guide must exist
- Guide must not be already approved
- Guide must not be already rejected
- Rejection reason included in email

---

## 🔒 Authentication & Authorization

### **Middleware Chain:**

1. **`authenticate`** - Verifies JWT token
   - Extracts user_id and role from token
   - Attaches to `req.user`

2. **`authorize(role)`** - Checks user role
   - Verifies user has required role
   - Roles: `'tourist'`, `'guide'`, `'admin'`

### **Route Protection:**

| Endpoint | Auth | Role |
|----------|------|------|
| POST /api/guides/register | No | Public |
| POST /api/guides/documents | Yes | guide |
| GET /api/guides/me | Yes | guide |
| GET /api/guides/dashboard | Yes | guide |
| POST /api/auth/login | No | Public |
| GET /api/admin/guides/pending | Yes | admin |
| GET /api/admin/guides/:id/documents | Yes | admin |
| PATCH /api/admin/guides/:id/approve | Yes | admin |
| PATCH /api/admin/guides/:id/reject | Yes | admin |

---

## 📊 Database Schema

### **users table:**
```sql
user_id SERIAL PRIMARY KEY
email VARCHAR UNIQUE NOT NULL
password_hash VARCHAR NOT NULL
role VARCHAR CHECK (role IN ('tourist', 'guide', 'admin'))
status VARCHAR CHECK (status IN ('pending', 'active', 'rejected'))
email_verified BOOLEAN DEFAULT FALSE
created_at TIMESTAMP DEFAULT NOW()
```

### **tour_guide table:**
```sql
guide_id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(user_id)
full_name VARCHAR NOT NULL
contact_number VARCHAR
approved BOOLEAN DEFAULT FALSE
created_at TIMESTAMP DEFAULT NOW()
```

### **guide_document table:**
```sql
document_id SERIAL PRIMARY KEY
guide_id INTEGER REFERENCES tour_guide(guide_id)
document_type VARCHAR CHECK (document_type IN ('license', 'certificate', 'id_card', 'other'))
document_url VARCHAR NOT NULL
verified BOOLEAN DEFAULT FALSE
uploaded_at TIMESTAMP DEFAULT NOW()
```

---

## 🧪 Testing Scenarios

### **Scenario 1: Successful Guide Onboarding**

```bash
# 1. Register guide
curl -X POST http://localhost:5000/api/guides/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newguide@example.com",
    "password": "Guide@123",
    "full_name": "Test Guide",
    "contact_number": "+94712345678"
  }'
# Response: 201, token returned

# 2. Upload document
curl -X POST http://localhost:5000/api/guides/documents \
  -H "Authorization: Bearer <token>" \
  -F "document=@license.pdf" \
  -F "document_type=license"
# Response: 201

# 3. Try to login (should fail - pending)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newguide@example.com",
    "password": "Guide@123"
  }'
# Response: 403 "Guide account pending admin approval"

# 4. Admin approves (use admin token)
curl -X PATCH http://localhost:5000/api/admin/guides/123/approve \
  -H "Authorization: Bearer <admin_token>"
# Response: 200

# 5. Login again (should succeed)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newguide@example.com",
    "password": "Guide@123"
  }'
# Response: 200, token returned

# 6. Access dashboard
curl -X GET http://localhost:5000/api/guides/dashboard \
  -H "Authorization: Bearer <guide_token>"
# Response: 200, dashboard data
```

### **Scenario 2: Guide Rejection**

```bash
# Admin rejects guide
curl -X PATCH http://localhost:5000/api/admin/guides/123/reject \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Documents not clear"
  }'
# Response: 200

# Guide tries to login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rejectedguide@example.com",
    "password": "Guide@123"
  }'
# Response: 403 "Account has been rejected. Please contact support."
```

---

## ✅ Completion Checklist

- [x] Guide registration creates pending account
- [x] Guide document upload to Supabase Storage
- [x] Guide login blocked while pending
- [x] Guide login blocked when rejected
- [x] Guide login allowed when active
- [x] Admin can view pending guides
- [x] Admin can view guide documents
- [x] Admin can approve guide (PATCH endpoint)
- [x] Admin can reject guide (PATCH endpoint)
- [x] Guide profile endpoint (GET /api/guides/me)
- [x] Guide dashboard endpoint (GET /api/guides/dashboard)
- [x] Email notifications for all status changes
- [x] Database transactions for approval
- [x] Proper error messages
- [x] Role-based access control
- [x] Follows existing code structure
- [x] Production-ready code quality

---

## 🚀 Status: PRODUCTION READY ✅

The tour guide authentication lifecycle is complete with:
- ✅ Registration → Document Upload → Admin Review → Approval/Rejection → Login → Dashboard
- ✅ Proper status checks at login
- ✅ Role-based authorization
- ✅ Email notifications
- ✅ Clean JSON responses
- ✅ Parameterized SQL queries
- ✅ Transaction safety

**Last Updated:** January 18, 2026
