export interface CrewMemoryRecord {
  crew_flow_name: string;
  memory_enabled: boolean;
  size_bytes: number;
  version_count: number;
  created_at: string | null;
  updated_at: string | null;
  user_count?: number;
}

export interface CrewFlowInfo {
  name: string;
  label: string;
  description: string;
}

export interface CrewMemoriesResponse {
  memories: CrewMemoryRecord[];
  available_flows: CrewFlowInfo[];
}

export interface CrewMemoryContentResponse {
  content: string;
  exists: boolean;
}
