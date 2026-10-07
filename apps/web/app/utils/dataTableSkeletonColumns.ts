export type DataTableSkeletonCellVariant =
  | 'single'
  | 'double'
  | 'issue'
  | 'chip'
  | 'button'

export interface DataTableSkeletonColumn {
  width?: string
  align?: 'left' | 'right' | 'center'
  cellVariant?: DataTableSkeletonCellVariant
  headerClass?: string
  cellClass?: string
}

/** Full Issues table (expand + issue + level + severity + pages + occurrences + points + actions). */
export const ISSUES_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '2.75rem', align: 'center', cellVariant: 'button' },
  { cellVariant: 'issue' },
  { width: '5.5rem', align: 'center', cellVariant: 'chip' },
  { width: '6.5rem', align: 'center', cellVariant: 'single' },
  { width: '7rem', align: 'center', cellVariant: 'single' },
  { width: '7rem', align: 'center', cellVariant: 'single' },
  { width: '5.5rem', align: 'center', cellVariant: 'single' },
  { width: '4.5rem', align: 'center', cellVariant: 'single' },
  { width: '6.5rem', align: 'center', cellVariant: 'single' },
  { width: '7rem', align: 'center', cellVariant: 'single' },
  { width: '2.75rem', align: 'right', cellVariant: 'button' }
]

/** Read-only Issues preview (issue + level + severity + pages + occurrences). */
export const ISSUES_TABLE_READONLY_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'issue' },
  { width: '4.5rem', cellVariant: 'chip' },
  { width: '5.5rem', cellVariant: 'single' },
  { width: '4.5rem', align: 'right', cellVariant: 'single' },
  { width: '6.5rem', align: 'right', cellVariant: 'single' }
]

/** Affected pages metrics skeleton (Title rail is rendered separately). */
export const AFFECTED_PAGES_METRICS_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '9.5rem', align: 'center', cellVariant: 'chip' },
  { width: '8.5rem', align: 'center', cellVariant: 'chip' },
  { width: '9rem', align: 'center', cellVariant: 'single' },
  { width: '9.5rem', align: 'center', cellVariant: 'single' },
  { width: '9.5rem', align: 'center', cellVariant: 'single' },
  { width: '8.5rem', align: 'center', cellVariant: 'single' },
  { width: '6.5rem', align: 'center', cellVariant: 'single' },
  { width: '9rem', align: 'center', cellVariant: 'single' },
  { width: '9.5rem', align: 'center', cellVariant: 'single' },
  { width: '3.25rem', align: 'right', cellVariant: 'button' }
]

/** Affected pages metrics skeleton when Site column is visible. */
export const AFFECTED_PAGES_METRICS_WITH_SITE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '10rem', align: 'left', cellVariant: 'single' },
  ...AFFECTED_PAGES_METRICS_SKELETON_COLUMNS
]

/** @deprecated Prefer AFFECTED_PAGES_METRICS_*. Title is a separate sticky rail. */
export const AFFECTED_PAGES_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  ...AFFECTED_PAGES_METRICS_SKELETON_COLUMNS
]

/** Readability pages table (url + title + words + score columns). */
export const READABILITY_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { cellVariant: 'single' },
  { width: '4rem', align: 'right', cellVariant: 'single' },
  { width: '4rem', align: 'right', cellVariant: 'single' },
  { width: '4rem', align: 'right', cellVariant: 'single' },
  { width: '4rem', align: 'right', cellVariant: 'single' }
]

/** Broken links flat table (site + url + page + status). */
export const BROKEN_LINKS_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'single' },
  { cellVariant: 'double' },
  { cellVariant: 'double' },
  { width: '5rem', align: 'right', cellVariant: 'chip' }
]

/** Inventory table (URL + file size). */
export const INVENTORY_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { width: '7rem', align: 'right', cellVariant: 'single' }
]

/** @deprecated Use INVENTORY_TABLE_SKELETON_COLUMNS */
export const INVENTORY_PAGES_TABLE_SKELETON_COLUMNS = INVENTORY_TABLE_SKELETON_COLUMNS

/** @deprecated Use INVENTORY_TABLE_SKELETON_COLUMNS */
export const INVENTORY_ASSETS_TABLE_SKELETON_COLUMNS = INVENTORY_TABLE_SKELETON_COLUMNS

/** Pages breakdown table (expand + url + A + AA + AAA + issues + actions). */
export const PAGES_BREAKDOWN_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '2.75rem', align: 'center', cellVariant: 'button' },
  { cellVariant: 'double' },
  { width: '3rem', align: 'center', cellVariant: 'single' },
  { width: '3rem', align: 'center', cellVariant: 'single' },
  { width: '3rem', align: 'center', cellVariant: 'single' },
  { width: '4rem', align: 'center', cellVariant: 'single' },
  { width: '2.75rem', align: 'right', cellVariant: 'button' }
]

/** SEO issues table (expand + issue + severity + pages + actions). */
export const SEO_ISSUE_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '2.75rem', align: 'center', cellVariant: 'button' },
  { cellVariant: 'issue' },
  { width: '5.5rem', cellVariant: 'single' },
  { width: '4.5rem', align: 'right', cellVariant: 'chip' },
  { width: '2.75rem', align: 'right', cellVariant: 'button' }
]

/** SEO issues table with site column. */
export const SEO_ISSUE_TABLE_WITH_SITE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '2.75rem', align: 'center', cellVariant: 'button' },
  { cellVariant: 'issue' },
  { width: '6rem', cellVariant: 'single' },
  { width: '5.5rem', cellVariant: 'single' },
  { width: '4.5rem', align: 'right', cellVariant: 'chip' },
  { width: '2.75rem', align: 'right', cellVariant: 'button' }
]

/** Sites table (site + frequency + next scan). */
export const SITES_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { width: '6rem', cellVariant: 'single' },
  { width: '8rem', cellVariant: 'single' }
]

/** Sites table with select + actions columns. */
export const SITES_TABLE_WITH_ACTIONS_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '2.5rem', align: 'center', cellVariant: 'button' },
  ...SITES_TABLE_SKELETON_COLUMNS,
  { width: '2.5rem', align: 'right', cellVariant: 'button' }
]

/** Spelling table (word + context + page url). */
export const SPELLING_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '6rem', cellVariant: 'single' },
  { cellVariant: 'single' },
  { cellVariant: 'double' }
]

/** Spelling table with site column. */
export const SPELLING_TABLE_WITH_SITE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '6rem', cellVariant: 'single' },
  ...SPELLING_TABLE_SKELETON_COLUMNS
]

/** Policy matches table. */
export const POLICY_MATCHES_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '8rem', cellVariant: 'single' },
  { cellVariant: 'single' },
  { cellVariant: 'double' },
  { cellVariant: 'double' },
  { width: '5rem', cellVariant: 'chip' },
  { width: '5rem', cellVariant: 'chip' },
  { width: '6rem', align: 'right', cellVariant: 'button' }
]

/** Policy matches table with site column. */
export const POLICY_MATCHES_TABLE_WITH_SITE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '6rem', cellVariant: 'single' },
  ...POLICY_MATCHES_TABLE_SKELETON_COLUMNS
]

/** Validated PDFs table (url + title + date + issues + actions). */
export const VALIDATED_PDFS_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { cellVariant: 'single' },
  { width: '7rem', cellVariant: 'single' },
  { width: '4rem', align: 'right', cellVariant: 'single' },
  { width: '2.75rem', align: 'right', cellVariant: 'button' }
]

/** PDF library table: select + title + metrics + rescan + actions. */
export const VALIDATED_PDFS_VALIDATE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '3.25rem', align: 'center', cellVariant: 'button' },
  { cellVariant: 'double' },
  { width: '5.5rem', align: 'center', cellVariant: 'single' },
  { width: '8.5rem', align: 'center', cellVariant: 'single' },
  { width: '5.5rem', align: 'center', cellVariant: 'single' },
  { width: '7.5rem', align: 'center', cellVariant: 'single' },
  { width: '5.5rem', align: 'center', cellVariant: 'single' },
  { width: '4.5rem', align: 'center', cellVariant: 'single' },
  { width: '6.5rem', align: 'center', cellVariant: 'single' },
  { width: '2.75rem', align: 'center', cellVariant: 'button' },
  { width: '2.75rem', align: 'right', cellVariant: 'button' }
]

export const VALIDATED_PDFS_VALIDATE_WITH_SITE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '3.25rem', align: 'center', cellVariant: 'button' },
  { cellVariant: 'double' },
  { width: '5.5rem', align: 'center', cellVariant: 'single' },
  { width: '7rem', cellVariant: 'single' },
  { width: '8.5rem', align: 'center', cellVariant: 'single' },
  { width: '5.5rem', align: 'center', cellVariant: 'single' },
  { width: '7.5rem', align: 'center', cellVariant: 'single' },
  { width: '5.5rem', align: 'center', cellVariant: 'single' },
  { width: '4.5rem', align: 'center', cellVariant: 'single' },
  { width: '6.5rem', align: 'center', cellVariant: 'single' },
  { width: '2.75rem', align: 'center', cellVariant: 'button' },
  { width: '2.75rem', align: 'right', cellVariant: 'button' }
]

/** @deprecated Use VALIDATED_PDFS_VALIDATE_SKELETON_COLUMNS */
export const VALIDATED_PDFS_AUDIT_SKELETON_COLUMNS = VALIDATED_PDFS_VALIDATE_SKELETON_COLUMNS

/** @deprecated Use VALIDATED_PDFS_VALIDATE_WITH_SITE_SKELETON_COLUMNS */
export const VALIDATED_PDFS_AUDIT_WITH_SITE_SKELETON_COLUMNS = VALIDATED_PDFS_VALIDATE_WITH_SITE_SKELETON_COLUMNS


/** Global search results (site + url + type + snippet + actions). */
export const GLOBAL_SEARCH_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '6rem', cellVariant: 'single' },
  { cellVariant: 'double' },
  { width: '5rem', cellVariant: 'chip' },
  { cellVariant: 'single' },
  { width: '5rem', align: 'right', cellVariant: 'button' }
]

/** Global search without site column. */
export const GLOBAL_SEARCH_NO_SITE_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { width: '5rem', cellVariant: 'chip' },
  { cellVariant: 'single' },
  { width: '5rem', align: 'right', cellVariant: 'button' }
]

/** Team members table (name + email + role). */
export const TEAM_MEMBERS_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { cellVariant: 'single' },
  { width: '6rem', cellVariant: 'chip' }
]

/** Team members table with select column. */
export const TEAM_MEMBERS_WITH_SELECT_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '2.5rem', align: 'center', cellVariant: 'button' },
  ...TEAM_MEMBERS_TABLE_SKELETON_COLUMNS
]

/** Broken links pages view (url + count). */
export const BROKEN_LINKS_PAGES_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { width: '5rem', align: 'right', cellVariant: 'single' }
]

/** Broken links grouped view (url + status + http + type + pages). */
export const BROKEN_LINKS_GROUPED_TABLE_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { width: '5rem', cellVariant: 'chip' },
  { width: '5rem', align: 'right', cellVariant: 'single' },
  { width: '4rem', cellVariant: 'single' },
  { width: '5rem', align: 'right', cellVariant: 'single' }
]

/** QA overview preview tables. */
export const QA_BROKEN_LINKS_PREVIEW_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { cellVariant: 'double' },
  { cellVariant: 'double' },
  { width: '5rem', align: 'right', cellVariant: 'chip' },
  { width: '5rem', cellVariant: 'single' }
]

export const QA_SPELLING_PREVIEW_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '6rem', cellVariant: 'single' },
  { cellVariant: 'single' },
  { cellVariant: 'double' }
]

export const QA_POLICY_MATCHES_PREVIEW_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { width: '8rem', cellVariant: 'single' },
  { cellVariant: 'single' },
  { width: '5rem', cellVariant: 'chip' }
]
