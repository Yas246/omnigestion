import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = await cookies();
  const hasAuth = cookieStore.get('omnigestion-auth')?.value;

  if (hasAuth) {
    redirect('/dashboard');
  }
  redirect('/login');
}
