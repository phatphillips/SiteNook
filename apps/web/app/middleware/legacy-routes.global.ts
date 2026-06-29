/** Redirect removed routes to their replacements. */
export default defineNuxtRouteMiddleware((to) => {
  const seoPages = to.path.match(/^\/sites\/([^/]+)\/seo\/pages\/?$/)
  if (seoPages) {
    return navigateTo(`/sites/${seoPages[1]}/seo/preview`, { replace: true })
  }

  const seoResolved = to.path.match(/^\/sites\/([^/]+)\/seo\/resolved\/?$/)
  if (seoResolved) {
    return navigateTo(`/sites/${seoResolved[1]}/seo/technical`, { replace: true })
  }

  const a11yResolved = to.path.match(/^\/sites\/([^/]+)\/accessibility\/resolved\/?$/)
  if (a11yResolved) {
    return navigateTo(`/sites/${a11yResolved[1]}/accessibility/issues`, { replace: true })
  }

  const pdfValidate = to.path.match(/^\/sites\/([^/]+)\/accessibility\/pdfs\/validate\/?$/)
  if (pdfValidate) {
    return navigateTo(`/sites/${pdfValidate[1]}/accessibility/pdfs`, { replace: true })
  }

  const pdfAudit = to.path.match(/^\/sites\/([^/]+)\/accessibility\/pdfs\/audit\/?$/)
  if (pdfAudit) {
    return navigateTo(`/sites/${pdfAudit[1]}/accessibility/pdfs`, { replace: true })
  }
})
