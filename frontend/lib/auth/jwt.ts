import { decodeJwt } from "jose";

export interface JWTPayload {
  sub: string;
  role: "admin" | "sales";
  type: string;
  iat: number;
  exp: number;
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return decodeJwt(token) as JWTPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

export function getTokenRole(token: string): "admin" | "sales" | null {
  return decodeToken(token)?.role ?? null;
}
