import { create } from "zustand";
import { api } from "../api";

export const useAuth = create(set => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  token: localStorage.getItem("token") || null,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    set({ token: data.token, user: data.user });
  },

  register: async (fullName, email, password) => {
    const { data } = await api.post("/auth/register", { fullName, email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    set({ token: data.token, user: data.user });
  },

  me: async () => {
    const { data } = await api.get("/auth/me");
    localStorage.setItem("user", JSON.stringify(data));
    set({ user: data });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, user: null });
  }
}));
