/// <reference path="../pb_data/types.d.ts" />

/** Read gate: any site_access role (including viewer). */
const SITE_ACCESS_READ =
  '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function siteAccessWrite(siteField) {
  return `@request.auth.role = "admin" || (@collection.site_access.site ?= ${siteField} && @collection.site_access.user ?= @request.auth.id && @collection.site_access.role ?!= "viewer")`
}

function orgSiteReadRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS_READ}${siteField}))`
}

function orgSiteWriteRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${siteAccessWrite(siteField)})`
}

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(new Field(field))
  }
}

migrate((app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
  const sites = app.findCollectionByNameOrId('sites')

  addFieldIfMissing(pdfDocuments, {
    name: 'structure_status',
    type: 'select',
    values: ['none', 'pending', 'processing', 'complete', 'failed'],
    maxSelect: 1
  })
  addFieldIfMissing(pdfDocuments, { name: 'structure_extracted_at', type: 'date' })
  addFieldIfMissing(pdfDocuments, { name: 'structure_error', type: 'text' })
  addFieldIfMissing(pdfDocuments, { name: 'structure_outline', type: 'json', maxSize: 65536 })
  addFieldIfMissing(pdfDocuments, {
    name: 'structure_json',
    type: 'file',
    maxSelect: 1,
    maxSize: 20971520,
    mimeTypes: ['application/json', 'text/plain']
  })
  addFieldIfMissing(pdfDocuments, {
    name: 'structure_html',
    type: 'file',
    maxSelect: 1,
    maxSize: 20971520,
    mimeTypes: ['text/html', 'text/plain']
  })
  addFieldIfMissing(pdfDocuments, {
    name: 'structure_markdown',
    type: 'file',
    maxSelect: 1,
    maxSize: 20971520,
    mimeTypes: ['text/markdown', 'text/plain']
  })
  addFieldIfMissing(pdfDocuments, { name: 'latest_remediation_id', type: 'text' })
  addFieldIfMissing(pdfDocuments, {
    name: 'remediation_status',
    type: 'select',
    values: ['none', 'pending', 'processing', 'complete', 'failed'],
    maxSelect: 1
  })
  app.save(pdfDocuments)

  let pdfRemediations
  try {
    pdfRemediations = app.findCollectionByNameOrId('pdf_remediations')
  } catch (_) {
    pdfRemediations = new Collection({
      name: 'pdf_remediations',
      type: 'base',
      listRule: orgSiteReadRule('site'),
      viewRule: orgSiteReadRule('site'),
      createRule: orgSiteWriteRule('site'),
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'pdf_document',
          type: 'relation',
          required: true,
          collectionId: pdfDocuments.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'site',
          type: 'relation',
          required: true,
          collectionId: sites.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'processing', 'complete', 'failed'],
          maxSelect: 1,
          required: true
        },
        { name: 'engine', type: 'text' },
        {
          name: 'artifact_kind',
          type: 'select',
          values: ['suggested_tagged', 'pdf_ua_export'],
          maxSelect: 1
        },
        {
          name: 'file',
          type: 'file',
          maxSelect: 1,
          maxSize: 20971520,
          mimeTypes: ['application/pdf']
        },
        { name: 'before_score', type: 'number', min: 0, max: 100 },
        { name: 'after_score', type: 'number', min: 0, max: 100 },
        { name: 'before_issue_count', type: 'number', min: 0 },
        { name: 'after_issue_count', type: 'number', min: 0 },
        { name: 'issue_delta', type: 'number' },
        { name: 'duration_ms', type: 'number', min: 0 },
        { name: 'error_message', type: 'text' },
        { name: 'summary', type: 'json', maxSize: 65536 }
      ],
      indexes: [
        'CREATE INDEX idx_pdf_remediations_document ON pdf_remediations (pdf_document)',
        'CREATE INDEX idx_pdf_remediations_site ON pdf_remediations (site)'
      ]
    })
    app.save(pdfRemediations)
  }

  try {
    app.findCollectionByNameOrId('pdf_remediation_queue')
  } catch (_) {
    const remediationQueue = new Collection({
      name: 'pdf_remediation_queue',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.id != ""',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'pdf_document',
          type: 'relation',
          required: true,
          collectionId: pdfDocuments.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'job_type',
          type: 'select',
          values: ['structure', 'remediate'],
          maxSelect: 1,
          required: true
        },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'processing', 'complete', 'failed', 'cancelled'],
          maxSelect: 1,
          required: true
        },
        { name: 'priority', type: 'number' },
        { name: 'error_message', type: 'text' },
        {
          name: 'remediation',
          type: 'relation',
          collectionId: pdfRemediations.id,
          maxSelect: 1,
          cascadeDelete: false
        }
      ],
      indexes: [
        'CREATE INDEX idx_pdf_remediation_queue_status ON pdf_remediation_queue (status)'
      ]
    })
    app.save(remediationQueue)
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('pdf_remediation_queue'))
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId('pdf_remediations'))
  } catch (_) {}
  try {
    const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
    for (const name of [
      'structure_status',
      'structure_extracted_at',
      'structure_error',
      'structure_outline',
      'structure_json',
      'structure_html',
      'structure_markdown',
      'latest_remediation_id',
      'remediation_status'
    ]) {
      try {
        pdfDocuments.fields.removeByName(name)
      } catch (_) {}
    }
    app.save(pdfDocuments)
  } catch (_) {}
})
