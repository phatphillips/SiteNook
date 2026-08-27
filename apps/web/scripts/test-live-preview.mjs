import {
  htmlSnapshotHasBody,
  prepareSimulatorPreviewHtml,
  truncateHtmlSnapshot
} from '../app/utils/simulatorHtml.ts'

async function main() {
  const url = process.argv[2] || 'https://anything.tas.gov.au/'
  console.log('fetching', url)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SiteNook-Simulator/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000)
  })
  console.log('status', res.status)
  const text = await res.text()
  console.log('live length', text.length, 'hasBody', htmlSnapshotHasBody(text))
  const truncated = truncateHtmlSnapshot(text)
  console.log('truncated length', truncated.length, 'hasBody', htmlSnapshotHasBody(truncated))
  const prepared = prepareSimulatorPreviewHtml(truncated, url)
  console.log('prepared length', prepared.length)
  console.log('snippet', prepared.slice(prepared.search(/<body/i), prepared.search(/<body/i) + 300).replace(/\s+/g, ' '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
