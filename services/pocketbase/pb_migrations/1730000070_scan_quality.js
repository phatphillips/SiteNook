/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  if (!scans.fields.getByName('scan_quality')) {
    scans.fields.add(new JSONField({ name: 'scan_quality' }))
  }
  app.save(scans)

  const sites = app.findCollectionByNameOrId('sites')
  if (!sites.fields.getByName('verification_due_at')) {
    sites.fields.add(new DateField({ name: 'verification_due_at' }))
  }
  app.save(sites)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const scanQuality = scans.fields.getByName('scan_quality')
  if (scanQuality) scans.fields.removeById(scanQuality.id)
  app.save(scans)

  const sites = app.findCollectionByNameOrId('sites')
  const verificationDue = sites.fields.getByName('verification_due_at')
  if (verificationDue) sites.fields.removeById(verificationDue.id)
  app.save(sites)
})
