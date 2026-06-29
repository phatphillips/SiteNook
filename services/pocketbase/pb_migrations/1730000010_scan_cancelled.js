/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const scanStatus = scans.fields.getByName('status')
  if (scanStatus && !scanStatus.values.includes('cancelled')) {
    scanStatus.values = [...scanStatus.values, 'cancelled']
  }
  app.save(scans)

  const scanQueue = app.findCollectionByNameOrId('scan_queue')
  const queueStatus = scanQueue.fields.getByName('status')
  if (queueStatus && !queueStatus.values.includes('cancelled')) {
    queueStatus.values = [...queueStatus.values, 'cancelled']
  }
  app.save(scanQueue)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const scanStatus = scans.fields.getByName('status')
  if (scanStatus) {
    scanStatus.values = scanStatus.values.filter(v => v !== 'cancelled')
  }
  app.save(scans)

  const scanQueue = app.findCollectionByNameOrId('scan_queue')
  const queueStatus = scanQueue.fields.getByName('status')
  if (queueStatus) {
    queueStatus.values = queueStatus.values.filter(v => v !== 'cancelled')
  }
  app.save(scanQueue)
})
