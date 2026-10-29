import PasswordRecoveryPage from '../../../modules/auth/components/PasswordRecoveryPage';

export default async function ResetPasswordRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const search = await searchParams;
  const token = typeof search.token === 'string' && search.token.trim() ? search.token : null;

  return <PasswordRecoveryPage token={token} />;
}
