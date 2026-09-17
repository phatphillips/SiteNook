/** Shared open state for the Add Site wizard (onboarding CTA + Sites page). */
export function useAddSiteWizard() {
  const open = useState('add-site-wizard-open', () => false)

  function openWizard() {
    open.value = true
  }

  function closeWizard() {
    open.value = false
  }

  return {
    open,
    openWizard,
    closeWizard
  }
}
