import type PocketBase from 'pocketbase'

export async function attachPageSimulatorPreview(
  pb: PocketBase,
  pageId: string,
  previewImage?: Buffer
): Promise<void> {
  if (!previewImage?.length) return

  try {
    const form = new FormData()
    form.append(
      'preview_image',
      new Blob([new Uint8Array(previewImage)], { type: 'image/jpeg' }),
      'preview.jpg'
    )
    await pb.collection('pages').update(pageId, form)
  } catch (err) {
    console.warn(
      `Failed to attach simulator preview for page ${pageId}:`,
      err instanceof Error ? err.message : err
    )
  }
}
