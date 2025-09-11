export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export const downloadUrl = (versionId: string) => `/api/files/${versionId}/download`;
export const previewUrl = (versionId: string) => `/api/files/${versionId}/preview`;
export const inlineUrl = (versionId: string) => `/api/files/${versionId}/download?inline=1`;
