import { downloadCsv } from '~/utils/csvExport'
import type { TableExportOptions } from '~/utils/tableExportScope'

export function useTableExport() {
  const toast = useToast()
  const exporting = ref(false)
  const progressMessage = ref('')

  async function runExport(
    filename: string,
    runner: (options: TableExportOptions, onProgress: (message: string) => void) => Promise<string>
  ) {
    exporting.value = true
    progressMessage.value = ''
    try {
      const content = await runner(
        {} as TableExportOptions,
        (message) => { progressMessage.value = message }
      )
      if (!content.trim()) {
        toast.add({ title: 'Nothing to export', color: 'warning' })
        return
      }
      downloadCsv(filename, content)
      toast.add({ title: 'Export complete', description: filename })
    } catch (e: unknown) {
      toast.add({
        title: 'Export failed',
        description: e instanceof Error ? e.message : String(e),
        color: 'error'
      })
    } finally {
      exporting.value = false
      progressMessage.value = ''
    }
  }

  async function executeExport(
    options: TableExportOptions,
    filename: string,
    build: (options: TableExportOptions, onProgress: (message: string) => void) => Promise<string>
  ) {
    exporting.value = true
    progressMessage.value = ''
    try {
      const content = await build(options, (message) => { progressMessage.value = message })
      if (!content.trim()) {
        toast.add({ title: 'Nothing to export', color: 'warning' })
        return
      }
      downloadCsv(filename, content)
      toast.add({ title: 'Export complete', description: filename })
    } catch (e: unknown) {
      toast.add({
        title: 'Export failed',
        description: e instanceof Error ? e.message : String(e),
        color: 'error'
      })
    } finally {
      exporting.value = false
      progressMessage.value = ''
    }
  }

  return {
    exporting,
    progressMessage,
    runExport,
    executeExport
  }
}
