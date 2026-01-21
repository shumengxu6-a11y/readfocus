# CookieCloud Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate CookieCloud to automatically sync and maintain valid WeChat Reading cookies, eliminating manual updates.

**Architecture:**
- **Cookie Fetcher**: A new backend utility that queries the CookieCloud server API.
- **Dynamic Auth**: API Routes will now fetch/refresh the cookie from CookieCloud on demand (with caching) instead of relying on a static env var.
- **Fallback Strategy**: If CookieCloud fails, fall back to the `.env.local` static cookie.

**Tech Stack:** Axios, Crypto-JS (for CookieCloud signature verification if needed, usually just simple API + UUID/Password).

---

### Task 1: Environment Configuration & Dependencies

**Files:**
- Modify: `readfocus/.env.local`
- Modify: `readfocus/package.json`

**Step 1: Update Environment Variables**
File: `readfocus/.env.local`
Add:
```env
# Keep existing WEREAD_COOKIE as fallback
COOKIECLOUD_HOST="http://your-cookiecloud-server-ip:8088"
COOKIECLOUD_UUID="your-cookiecloud-uuid"
COOKIECLOUD_PASSWORD="your-cookiecloud-password"
```

**Step 2: Install Dependencies**
Command:
```bash
npm install crypto-js
npm install --save-dev @types/crypto-js
```

---

### Task 2: Implement CookieCloud Client

**Files:**
- Create: `readfocus/lib/cookiecloud.ts`

**Step 1: Create Client Logic**
Logic:
- Function `getWereadCookieFromCloud()`
- Fetch from `${COOKIECLOUD_HOST}/get/${COOKIECLOUD_UUID}`.
- Basic Auth validation if password is used (md5 signature often required by CookieCloud, or simple query param depending on version). *Note: Standard CookieCloud uses encrypted data usually, but simple GET endpoint often returns JSON if authorized.*
- Parse JSON response to find domain `weread.qq.com`.
- Extract `wr_skey`, `wr_vid` and other fields.
- Assemble into Cookie string.

---

### Task 3: Update API Routes to Use Dynamic Cookie

**Files:**
- Modify: `readfocus/app/api/weread/notebooks/route.ts`
- Modify: `readfocus/app/api/weread/bookmarks/route.ts`

**Step 1: Modify Notebooks Route**
Logic:
- Remove direct `process.env.WEREAD_COOKIE` dependency.
- Call `getWereadCookieFromCloud()`.
- If that fails, fallback to `process.env.WEREAD_COOKIE`.
- Use the obtained cookie for the Axios request.

**Step 2: Modify Bookmarks Route**
Logic:
- Apply same logic as Notebooks route.

---

### Task 4: Verify Integration

**Files:**
- Manual Verification

**Step 1: Test**
- Need a real CookieCloud instance. (For dev, user might not have one yet).
- We will mock the `getWereadCookieFromCloud` response structure for initial testing if user hasn't provided config.
- **Action**: User needs to install CookieCloud extension and have a server. *If user doesn't have a server, we can suggest using a local docker or public test instance.*

