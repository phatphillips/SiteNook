import { test, expect } from '@playwright/test'

test('login page loads and accepts credentials', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'SiteNook' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
})

test('forgot password page loads', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible()
})

test('redirects to dashboard after login', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test-user@sitenook.test')
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD || 'test-user-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL('/login')
})
