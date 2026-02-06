#!/usr/bin/env tsx
/**
 * Script to update user email in Supabase
 * Usage: SUPABASE_SERVICE_ROLE_KEY=your_key tsx scripts/update-user-email.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'your-supabase-url'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateUserEmail(
  userId: string,
  newEmail: string
) {
  console.log(`Updating email for user ${userId} to ${newEmail}...`)

  try {
    // Update auth email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    )

    if (authError) {
      console.error('Error updating auth email:', authError)
      throw authError
    }

    console.log('✓ Auth email updated successfully')

    // Update profile email
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', userId)
      .select()

    if (profileError) {
      console.error('Error updating profile email:', profileError)
      throw profileError
    }

    console.log('✓ Profile email updated successfully')
    console.log('\nUpdate complete!')
    console.log('Auth user:', authData.user.email)
    console.log('Profile:', profileData[0]?.email)

  } catch (error) {
    console.error('Failed to update email:', error)
    process.exit(1)
  }
}

// Update the specific user
const USER_ID = '8a1fc157-a08c-42b5-9592-6e49a120ce6a'
const OLD_EMAIL = 'victormr10603@gmail.com'
const NEW_EMAIL = 'martinriveravictor@gmail.com'

console.log(`\nChanging email:`)
console.log(`  User ID: ${USER_ID}`)
console.log(`  From: ${OLD_EMAIL}`)
console.log(`  To: ${NEW_EMAIL}\n`)

updateUserEmail(USER_ID, NEW_EMAIL)
