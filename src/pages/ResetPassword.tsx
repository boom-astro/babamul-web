import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field';
import api from '@/lib/api';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const e = params.get('email');
    const t = params.get('token');
    if (e) setEmail(e);
    if (t) setToken(t);
  }, [location.search]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(email, token, password);
      setDone(true);
      // Redirect to login after a short delay
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const missingParams = !email || !token;

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {missingParams
                ? 'This link appears to be invalid or expired.'
                : `Enter a new password for ${email}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Your password has been reset. Redirecting to login…
                </p>
                <Link to="/login" className="text-sm underline underline-offset-4">
                  Go to login
                </Link>
              </div>
            ) : missingParams ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Please use the link from the password reset email. If the link has expired, request a new one.
                </p>
                <Link to="/forgot-password" className="text-sm underline underline-offset-4">
                  Request a new reset link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="password">New password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <FieldDescription>Minimum 8 characters.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
                    <Input
                      id="confirm"
                      type="password"
                      placeholder="Repeat your password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Resetting…' : 'Reset password'}
                    </Button>
                  </Field>
                </FieldGroup>
                {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
