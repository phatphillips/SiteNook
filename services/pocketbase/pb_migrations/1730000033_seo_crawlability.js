/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scansCollection = app.findCollectionByNameOrId('scans')

  if (!scansCollection.fields.getByName('score_seo_crawlability')) {
    scansCollection.fields.add(new Field({
      name: 'score_seo_crawlability',
      type: 'number',
      min: 0,
      max: 100
    }))
  }

  if (!scansCollection.fields.getByName('seo_crawl_audit')) {
    scansCollection.fields.add(new Field({
      name: 'seo_crawl_audit',
      type: 'json',
      maxSize: 8192
    }))
  }

  app.save(scansCollection)
}, (app) => {
  const scansCollection = app.findCollectionByNameOrId('scans')
  const crawlScore = scansCollection.fields.getByName('score_seo_crawlability')
  if (crawlScore) scansCollection.fields.removeById(crawlScore.id)
  const crawlAudit = scansCollection.fields.getByName('seo_crawl_audit')
  if (crawlAudit) scansCollection.fields.removeById(crawlAudit.id)
  app.save(scansCollection)
})
