import {useQuery} from "@tanstack/react-query";
import {apiClient} from "../client";

export function useUserQuery() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const response = await apiClient.get("/user");
      if (response.status !== 200) {
        throw new Error('Failed to fetch user');
      }
      return response.data as { id: string; name: string, email: string };
    }
  });
}