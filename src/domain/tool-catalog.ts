export interface ToolDescriptor {
  name: string;
  folder: string;
  description: string;
}

export interface ToolFolderSummary {
  folder: string;
  toolCount: number;
  children: string[];
}

export interface ToolCatalogList {
  toolCount: number;
  folders: ToolFolderSummary[];
  tools?: string[];
}
