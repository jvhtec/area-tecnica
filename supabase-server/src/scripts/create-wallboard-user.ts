import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.SUPABASE_URL as string
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  const password = process.env.WALLBOARD_INIT_PASSWORD as string
  if (!url || !service || !password) {
    console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WALLBOARD_INIT_PASSWORD')
    process.exit(1)
  }
  const supabase = createClient(url, service)
  const email = 'wallboard@internal.local'
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'wallboard' },
    app_metadata: { role: 'wallboard' }
  })
  console.log({ data, error })
  if (error) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })

