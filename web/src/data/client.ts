import axios from "axios";

export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: "richard",
    "Content-Type": "application/json",
  },
});