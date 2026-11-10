// Prisma enums (manzu-b prisma/schema.prisma).
export type PharmacyUserRole = 'MANAGER' | 'PHARMACIST' | 'ADMIN' | 'STAFF' | 'OWNER' | 'TECHNICIAN';
export type PharmacyStatus = 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'CLOSED';
export type PharmacyType = 'COMMUNITY' | 'HOSPITAL' | 'SPECIALTY' | 'PMV';

// POST /api/auth/login — manzu-b routes/auth.js (loginSchema in utils/adminValidation.js).
export interface LoginRequest {
  email: string;
  pin: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  refreshToken: string;
  user: { id: number; email: string; name: string; role: PharmacyUserRole };
  // G11: status and isActive are returned by the backend (not blocked, app shows a banner — PLAN D4).
  pharmacy: { id: number; name: string; status?: PharmacyStatus; isActive?: boolean };
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: PharmacyUserRole;
}

export interface SessionPharmacy {
  id: number;
  name: string;
  status?: PharmacyStatus;
  isActive?: boolean;
  logoUrl?: string | null;
}

// POST /api/auth/refresh — rotates the refresh token (G2).
export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  message: string;
  token: string;
  refreshToken: string;
  user: { id: number; name: string; email: string; role: PharmacyUserRole };
  pharmacy: { id: number; name: string; status?: PharmacyStatus; isActive?: boolean; logoUrl?: string | null };
}

// POST /api/auth/logout — revokes the whole login chain. Idempotent.
export interface LogoutRequest {
  refreshToken: string;
}

// GET /api/auth/me — current user + pharmacy (G1).
export interface MeResponse {
  user: { id: number; name: string; email: string; role: PharmacyUserRole };
  pharmacy: { id: number; name: string; status?: PharmacyStatus; isActive?: boolean; logoUrl?: string | null };
}

// POST /api/auth/register — manzu-b registerSchema. Creates the pharmacy (PENDING) and its MANAGER user.
export interface RegisterRequest {
  pharmacy: {
    name: string;
    licenseNumber: string;
    phone: string;
    address: string;
    state: string;
    lga: string;
    latitude: number;
    longitude: number;
    locationAccuracy?: number;
  };
  user: { name: string; email: string; pin: string };
}

/** Same shape as LoginResponse (status 201). */
export type RegisterResponse = LoginResponse;