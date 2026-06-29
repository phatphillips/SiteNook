/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const scanStatus = scans.fields.getByName('status')
  if (scanStatus) {
    for (const value of ['background_scan', 'complete_with_errors']) {
      if (!scanStatus.values.includes(value)) {
        scanStatus.values = [...scanStatus.values, value]
      }
    }
  }

  if (!scans.fields.getByName('unscanned_urls')) {
    scans.fields.add(new JsonField({
      name: 'unscanned_urls',
      required: false
    }))
  }

  if (!scans.fields.getByName('background_retry')) {
    scans.fields.add(new JsonField({
      name: 'background_retry',
      required: false
    }))
  }

  app.save(scans)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const scanStatus = scans.fields.getByName('status')
  if (scanStatus) {
    scanStatus.values = scanStatus.values.filter(
      v => v !== 'background_scan' && v !== 'complete_with_errors'
    )
  }

  const unscanned = scans.fields.getByName('unscanned_urls')
  if (unscanned) scans.fields.removeById(unscanned.id)

  const bg = scans.fields.getByName('background_retry')
  if (bg) scans.fields.removeById(bg.id)

  app.save(scans)
})
