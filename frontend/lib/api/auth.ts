import { api } from "./client";
import type { LoginRequest, LoginResponse, User } from "@/types";
import { API_ROUTES } from "@/lib/constants";

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>(API_ROUTES.AUTH.LOGIN, data).then((r) => r.data),
  refresh: () =>
    api.post<{ access_token: string }>(API_ROUTES.AUTH.REFRESH).then((r) => r.data),
  logout: () => api.post(API_ROUTES.AUTH.LOGOUT),
  me: () => api.get<User>(API_ROUTES.AUTH.ME).then((r) => r.data),
};
