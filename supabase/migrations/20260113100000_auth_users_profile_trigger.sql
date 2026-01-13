-- Ensure a `profiles` row exists for every new `auth.users` record
-- The `public.handle_new_user()` function is defined in the base schema.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

