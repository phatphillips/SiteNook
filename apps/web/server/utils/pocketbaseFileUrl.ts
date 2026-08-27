type FileQueryParams = Record<string, unknown>

type PocketBaseFiles = {
  getURL?: (record: object, filename: string, queryParams?: FileQueryParams) => string
  getUrl?: (record: object, filename: string, queryParams?: FileQueryParams) => string
}

/**
 * PocketBase JS SDK 0.26 renamed `files.getUrl` to `files.getURL` and the old
 * name throws. Prefer `getURL`, fall back for 0.25.
 */
export function pocketBaseFileUrl(
  pb: { files: PocketBaseFiles },
  record: object,
  filename: string,
  queryParams?: FileQueryParams
): string {
  const files = pb.files
  if (typeof files?.getURL === 'function') {
    return files.getURL(record, filename, queryParams)
  }
  if (typeof files?.getUrl === 'function') {
    return files.getUrl(record, filename, queryParams)
  }
  throw new Error('PocketBase file URL helper is unavailable')
}
