/// <reference path="../pb_data/types.d.ts" />

function estimateUtf8Bytes(text) {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code <= 0x7f) bytes += 1
    else if (code <= 0x7ff) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4
      i++
    } else {
      bytes += 3
    }
  }
  return bytes
}

migrate((app) => {
  const pages = app.findCollectionByNameOrId('pages')
  if (!pages.fields.getByName('html_size_bytes')) {
    pages.fields.add(new Field({
      name: 'html_size_bytes',
      type: 'number',
      min: 0
    }))
    app.save(pages)
  }

  const records = app.findRecordsByFilter('pages', 'html_snapshot != ""')
  for (const record of records) {
    if (record.get('html_size_bytes')) continue
    const snapshot = String(record.get('html_snapshot') || '')
    if (!snapshot) continue
    record.set('html_size_bytes', estimateUtf8Bytes(snapshot))
    app.save(record)
  }
}, (app) => {
  const pages = app.findCollectionByNameOrId('pages')
  const field = pages.fields.getByName('html_size_bytes')
  if (field) {
    pages.fields.removeById(field.id)
    app.save(pages)
  }
})
