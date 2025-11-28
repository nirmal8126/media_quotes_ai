"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type AuthMode = 'signin' | 'signup';

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

const initialFormData: FormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [formData, setFormData] = useState<FormData>({ ...initialFormData });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  useEffect(() => {
    setFormData({ ...initialFormData });
    setErrors({});
    setStatusMessage(null);
    setStatusType(null);
  }, [mode]);

  const validateField = (field: keyof FormData, values: FormData): string => {
    const trimmedValue = values[field].trim();
    const trimmedPassword = values.password.trim();

    switch (field) {
      case 'name':
        if (!isSignup) return '';
        if (trimmedValue.length < 2) return 'Enter a real name (at least 2 characters).';
        return '';
      case 'email':
        if (!trimmedValue) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) return 'Enter a valid email address.';
        return '';
      case 'password': {
        if (!trimmedPassword) return 'Password is required.';
        if (trimmedPassword.length < 8) return 'At least 8 characters required.';
        if (!/[A-Z]/.test(trimmedPassword)) return 'Add at least one uppercase letter.';
        if (!/[a-z]/.test(trimmedPassword)) return 'Add at least one lowercase letter.';
        if (!/[0-9]/.test(trimmedPassword)) return 'Include a number.';
        if (!/[\W_]/.test(trimmedPassword)) return 'Include a symbol like !@#$.';
        return '';
      }
      case 'confirmPassword':
        if (!isSignup) return '';
        if (!trimmedValue) return 'Confirm your password.';
        if (trimmedValue !== trimmedPassword) return 'Passwords do not match.';
        return '';
      default:
        return '';
    }
  };

  const buildFieldErrors = (field: keyof FormData, values: FormData): FieldErrors => {
    const updatedErrors: FieldErrors = {};
    updatedErrors[field] = validateField(field, values);
    if (field === 'password') {
      updatedErrors.confirmPassword = validateField('confirmPassword', values);
    }
    if (field === 'confirmPassword' && isSignup) {
      updatedErrors.password = validateField('password', values);
    }
    return updatedErrors;
  };

  const validateForm = (): boolean => {
    const relevantFields: Array<keyof FormData> = ['email', 'password'];
    if (isSignup) relevantFields.unshift('confirmPassword', 'name');
    const nextErrors: FieldErrors = {};

    relevantFields.forEach((field) => {
      nextErrors[field] = validateField(field, formData);
      if (field === 'password' && isSignup) {
        nextErrors.confirmPassword = validateField('confirmPassword', formData);
      }
    });

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.values(nextErrors).every((value) => !value);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof FormData;
    const value = event.target.value;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      setErrors((prevErrors) => ({ ...prevErrors, ...buildFieldErrors(field, next) }));
      return next;
    });
  };

  const canSubmit = useMemo(() => {
    const hasRequiredFields = Boolean(
      formData.email.trim() && formData.password.trim() && (!isSignup || (formData.name.trim() && formData.confirmPassword.trim())),
    );
    const hasErrors = Object.values(errors).some(Boolean);
    return hasRequiredFields && !hasErrors && !isSubmitting;
  }, [errors, formData, isSignup, isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) {
      setStatusMessage('Fix the highlighted fields before continuing.');
      setStatusType('error');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusType(null);

    const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
    const payload = mode === 'signin'
      ? { email: formData.email.trim(), password: formData.password }
      : { name: formData.name.trim(), email: formData.email.trim(), password: formData.password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatusMessage(body?.error || 'Something went wrong.');
        setStatusType('error');
        return;
      }

      setStatusMessage(mode === 'signin' ? 'Signed in successfully.' : 'Sign-up complete—check your email.');
      setStatusType('success');
    } catch (error) {
      setStatusMessage((error as Error).message || 'Unable to reach the auth service.');
      setStatusType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordRequirements = [
    'At least 8 characters',
    'Uppercase and lowercase letters',
    'At least one number',
    'At least one symbol (e.g. !@#$)',
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-slate-50 px-6 py-12 text-slate-900">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-orange-400">MediaQuotes AI</p>
        <h1 className="text-4xl font-semibold">Creator access portal</h1>
        <p className="text-sm text-slate-600">
          Use the email linked to your team to sign in or create a new account. Every request is secured through Supabase
          Auth before you reach the dashboard.
        </p>
      </div>

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
        <div className="flex gap-2 text-xs uppercase tracking-[0.4em] text-slate-500">
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signup' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setMode('signup')}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="space-y-4 text-sm" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <label className="flex flex-col gap-1 text-slate-600">
              Name
              <input
                className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.name ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Creator name"
                aria-invalid={Boolean(errors.name)}
                required={isSignup}
              />
              {errors.name ? <span className="text-xs text-rose-500">{errors.name}</span> : null}
            </label>
          )}
          <label className="flex flex-col gap-1 text-slate-600">
            Email
            <input
              className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.email ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@mediaquotes.ai"
              aria-invalid={Boolean(errors.email)}
              required
            />
            {errors.email && <span className="text-xs text-rose-500">{errors.email}</span>}
          </label>
          <label className="flex flex-col gap-1 text-slate-600">
            Password
            <input
              className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.password ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={isSignup ? 'Create a password' : 'Enter your password'}
              aria-invalid={Boolean(errors.password)}
              required
            />
            {errors.password && <span className="text-xs text-rose-500">{errors.password}</span>}
          </label>
          {isSignup && (
            <label className="flex flex-col gap-1 text-slate-600">
              Confirm password
              <input
                className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.confirmPassword ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat password"
                aria-invalid={Boolean(errors.confirmPassword)}
                required
              />
              {errors.confirmPassword && <span className="text-xs text-rose-500">{errors.confirmPassword}</span>}
            </label>
          )}

          {isSignup && (
            <ul className="text-[0.65rem] text-slate-500">
              {passwordRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <button
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${canSubmit ? 'bg-orange-400 text-slate-950 hover:bg-orange-300' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
            type="submit"
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Working…' : isSignup ? 'Create account' : 'Continue to dashboard'}
          </button>
        </form>

        {statusMessage && (
          <p className={`text-center text-xs ${statusType === 'success' ? 'text-green-500' : 'text-rose-500'}`}>
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type AuthMode = 'signin' | 'signup';

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

const initialFormData: FormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [formData, setFormData] = useState<FormData>({ ...initialFormData });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  useEffect(() => {
    setFormData({ ...initialFormData });
    setErrors({});
    setStatusMessage(null);
    setStatusType(null);
  }, [mode]);

  const validateField = (field: keyof FormData, values: FormData): string => {
    const trimmedValue = values[field].trim();
    const trimmedPassword = values.password.trim();

    switch (field) {
      case 'name':
        if (!isSignup) return '';
        if (trimmedValue.length < 2) return 'Enter a real name (at least 2 characters).';
        return '';
      case 'email':
        if (!trimmedValue) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) return 'Enter a valid email address.';
        return '';
      case 'password': {
        if (!trimmedPassword) return 'Password is required.';
        if (trimmedPassword.length < 8) return 'At least 8 characters required.';
        if (!/[A-Z]/.test(trimmedPassword)) return 'Add at least one uppercase letter.';
        if (!/[a-z]/.test(trimmedPassword)) return 'Add at least one lowercase letter.';
        if (!/[0-9]/.test(trimmedPassword)) return 'Include a number.';
        if (!/[\W_]/.test(trimmedPassword)) return 'Include a symbol like !@#$.';
        return '';
      }
      case 'confirmPassword':
        if (!isSignup) return '';
        if (!trimmedValue) return 'Confirm your password.';
        if (trimmedValue !== trimmedPassword) return 'Passwords do not match.';
        return '';
      default:
        return '';
    }
  };

  const buildFieldErrors = (field: keyof FormData, values: FormData): FieldErrors => {
    const updatedErrors: FieldErrors = {};
    updatedErrors[field] = validateField(field, values);
    if (field === 'password') {
      updatedErrors.confirmPassword = validateField('confirmPassword', values);
    }
    if (field === 'confirmPassword' && isSignup) {
      updatedErrors.password = validateField('password', values);
    }
    return updatedErrors;
  };

  const validateForm = (): boolean => {
    const relevantFields: Array<keyof FormData> = ['email', 'password'];
    if (isSignup) relevantFields.unshift('confirmPassword', 'name');
    const nextErrors: FieldErrors = {};

    relevantFields.forEach((field) => {
      nextErrors[field] = validateField(field, formData);
      if (field === 'password' && isSignup) {
        nextErrors.confirmPassword = validateField('confirmPassword', formData);
      }
    });

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.values(nextErrors).every((value) => !value);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof FormData;
    const value = event.target.value;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      setErrors((prevErrors) => ({ ...prevErrors, ...buildFieldErrors(field, next) }));
      return next;
    });
  };

  const canSubmit = useMemo(() => {
    const hasRequiredFields = Boolean(
      formData.email.trim() && formData.password.trim() && (!isSignup || (formData.name.trim() && formData.confirmPassword.trim())),
    );
    const hasErrors = Object.values(errors).some(Boolean);
    return hasRequiredFields && !hasErrors && !isSubmitting;
  }, [errors, formData, isSignup, isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) {
      setStatusMessage('Fix the highlighted fields before continuing.');
      setStatusType('error');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusType(null);

    const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
    const payload = mode === 'signin'
      ? { email: formData.email.trim(), password: formData.password }
      : { name: formData.name.trim(), email: formData.email.trim(), password: formData.password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatusMessage(body?.error || 'Something went wrong.');
        setStatusType('error');
        return;
      }

      setStatusMessage(mode === 'signin' ? 'Signed in successfully.' : 'Sign-up complete—check your email.');
      setStatusType('success');
    } catch (error) {
      setStatusMessage((error as Error).message || 'Unable to reach the auth service.');
      setStatusType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordRequirements = [
    'At least 8 characters',
    'Uppercase and lowercase letters',
    'At least one number',
    'At least one symbol (e.g. !@#$)',
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-slate-50 px-6 py-12 text-slate-900">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-orange-400">MediaQuotes AI</p>
        <h1 className="text-4xl font-semibold">Creator access portal</h1>
        <p className="text-sm text-slate-600">
          Use the email linked to your team to sign in or create a new account. Every request is secured through Supabase
          Auth before you reach the dashboard.
        </p>
      </div>

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
        <div className="flex gap-2 text-xs uppercase tracking-[0.4em] text-slate-500">
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signup' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setMode('signup')}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="space-y-4 text-sm" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <label className="flex flex-col gap-1 text-slate-600">
              Name
              <input
                className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.name ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Creator name"
                aria-invalid={Boolean(errors.name)}
                required={isSignup}
              />
              {errors.name ? <span className="text-xs text-rose-500">{errors.name}</span> : null}
            </label>
          )}
          <label className="flex flex-col gap-1 text-slate-600">
            Email
            <input
              className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.email ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@mediaquotes.ai"
              aria-invalid={Boolean(errors.email)}
              required
            />
            {errors.email && <span className="text-xs text-rose-500">{errors.email}</span>}
          </label>
          <label className="flex flex-col gap-1 text-slate-600">
            Password
            <input
              className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.password ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={isSignup ? 'Create a password' : 'Enter your password'}
              aria-invalid={Boolean(errors.password)}
              required
            />
            {errors.password && <span className="text-xs text-rose-500">{errors.password}</span>}
          </label>
          {isSignup && (
            <label className="flex flex-col gap-1 text-slate-600">
              Confirm password
              <input
                className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.confirmPassword ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat password"
                aria-invalid={Boolean(errors.confirmPassword)}
                required
              />
              {errors.confirmPassword && <span className="text-xs text-rose-500">{errors.confirmPassword}</span>}
            </label>
          )}

          {isSignup && (
            <ul className="text-[0.65rem] text-slate-500">
              {passwordRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <button
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${canSubmit ? 'bg-orange-400 text-slate-950 hover:bg-orange-300' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
            type="submit"
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Working…' : isSignup ? 'Create account' : 'Continue to dashboard'}
          </button>
        </form>

        {statusMessage && (
          <p className={`text-center text-xs ${statusType === 'success' ? 'text-green-500' : 'text-rose-500'}`}>
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type AuthMode = 'signin' | 'signup';

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

const initialFormData: FormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [formData, setFormData] = useState<FormData>({ ...initialFormData });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  useEffect(() => {
    setFormData({ ...initialFormData });
    setErrors({});
    setStatusMessage(null);
    setStatusType(null);
  }, [mode]);

  const validateField = (field: keyof FormData, values: FormData): string => {
    const trimmedValue = values[field].trim();

    switch (field) {
      case 'name':
        if (!isSignup) return '';
        if (trimmedValue.length < 2) return 'Enter a real name (at least 2 characters).';
        return '';
      case 'email':
        if (!trimmedValue) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) return 'Enter a valid email address.';
        return '';
      case 'password': {
        if (!trimmedValue) return 'Password is required.';
        if (trimmedValue.length < 8) return 'At least 8 characters required.';
        if (!/[A-Z]/.test(trimmedValue)) return 'Add at least one uppercase letter.';
        if (!/[a-z]/.test(trimmedValue)) return 'Add at least one lowercase letter.';
        if (!/[0-9]/.test(trimmedValue)) return 'Include a number.';
        if (!/[\W_]/.test(trimmedValue)) return 'Include a symbol like !@#$.'.
        return '';
      }
      case 'confirmPassword':
        if (!isSignup) return '';
        if (!trimmedValue) return 'Confirm your password.';
        if (trimmedValue !== values.password) return 'Passwords do not match.';
        return '';
      default:
        return '';
    }
  };

  const buildFieldErrors = (field: keyof FormData, values: FormData): FieldErrors => {
    const updatedErrors: FieldErrors = {};
    updatedErrors[field] = validateField(field, values);
    if (field === 'password') {
      updatedErrors.confirmPassword = validateField('confirmPassword', values);
    }
    if (field === 'confirmPassword' && isSignup) {
      updatedErrors.password = validateField('password', values);
    }
    return updatedErrors;
  };

  const validateForm = (): boolean => {
    const relevantFields: Array<keyof FormData> = ['email', 'password'];
    if (isSignup) relevantFields.unshift('confirmPassword', 'name');
    const nextErrors: FieldErrors = {};

    relevantFields.forEach((field) => {
      nextErrors[field] = validateField(field, formData);
      if (field === 'password' && isSignup) {
        nextErrors.confirmPassword = validateField('confirmPassword', formData);
      }
    });

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.values(nextErrors).every((value) => !value);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof FormData;
    const value = event.target.value;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      setErrors((prevErrors) => ({ ...prevErrors, ...buildFieldErrors(field, next) }));
      return next;
    });
  };

  const canSubmit = useMemo(() => {
    const hasRequiredFields = formData.email.trim() && formData.password.trim() && (!isSignup || (formData.name.trim() && formData.confirmPassword.trim()));
    const hasErrors = Object.values(errors).some(Boolean);
    return Boolean(hasRequiredFields) && !hasErrors && !isSubmitting;
  }, [errors, formData, isSignup, isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) {
      setStatusMessage('Fix the highlighted fields before continuing.');
      setStatusType('error');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusType(null);

    const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
    const payload = mode === 'signin'
      ? { email: formData.email.trim(), password: formData.password }
      : { name: formData.name.trim(), email: formData.email.trim(), password: formData.password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatusMessage(body?.error || 'Something went wrong.');
        setStatusType('error');
        return;
      }

      setStatusMessage(mode === 'signin' ? 'Signed in successfully.' : 'Sign-up complete—check your email.');
      setStatusType('success');
    } catch (error) {
      setStatusMessage((error as Error).message || 'Unable to reach the auth service.');
      setStatusType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordRequirements = [
    'At least 8 characters',
    'Uppercase and lowercase letters',
    'At least one number',
    'At least one symbol (e.g. !@#$)',
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-slate-50 px-6 py-12 text-slate-900">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-orange-400">MediaQuotes AI</p>
        <h1 className="text-4xl font-semibold">Creator access portal</h1>
        <p className="text-sm text-slate-600">
          Use the email linked to your team to sign in or create a new account. Every request is secured through Supabase
          Auth before you reach the dashboard.
        </p>
      </div>

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
        <div className="flex gap-2 text-xs uppercase tracking-[0.4em] text-slate-500">
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signup' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setMode('signup')}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="space-y-4 text-sm" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <label className="flex flex-col gap-1 text-slate-600">
              Name
              <input
                className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.name ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Creator name"
                aria-invalid={Boolean(errors.name)}
                required={isSignup}
              />
              {errors.name ? (
                <span className="text-xs text-rose-500">{errors.name}</span>
              ) : null}
            </label>
          )}
          <label className="flex flex-col gap-1 text-slate-600">
            Email
            <input
              className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.email ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@mediaquotes.ai"
              aria-invalid={Boolean(errors.email)}
              required
            />
            {errors.email && <span className="text-xs text-rose-500">{errors.email}</span>}
          </label>
          <label className="flex flex-col gap-1 text-slate-600">
            Password
            <input
              className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.password ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={isSignup ? 'Create a password' : 'Enter your password'}
              aria-invalid={Boolean(errors.password)}
              required
            />
            {errors.password && <span className="text-xs text-rose-500">{errors.password}</span>}
          </label>
          {isSignup && (
            <label className="flex flex-col gap-1 text-slate-600">
              Confirm password
              <input
                className={`rounded-2xl border px-4 py-3 text-base outline-none transition ${errors.confirmPassword ? 'border-rose-400 bg-slate-50 focus:border-rose-500' : 'border-slate-200 bg-white focus:border-orange-400'}`}
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat password"
                aria-invalid={Boolean(errors.confirmPassword)}
                required
              />
              {errors.confirmPassword && <span className="text-xs text-rose-500">{errors.confirmPassword}</span>}
            </label>
          )}

          {isSignup && (
            <ul className="text-[0.65rem] text-slate-500">
              {passwordRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <button
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${canSubmit ? 'bg-orange-400 text-slate-950 hover:bg-orange-300' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
            type="submit"
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Working…' : isSignup ? 'Create account' : 'Continue to dashboard'}
          </button>
        </form>

        {statusMessage && (
          <p className={`text-center text-xs ${statusType === 'success' ? 'text-green-500' : 'text-rose-500'}`}>
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}"use client";

import { ChangeEvent, FormEvent, useState } from 'react';

type AuthMode = 'signin' | 'signup';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setStatusType(null);

    const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
    const payload = mode === 'signin'
      ? { email: formData.email, password: formData.password }
      : formData;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatusMessage(body?.error || 'Something went wrong.');
      setStatusType('error');
      return;
    }

    setStatusMessage(mode === 'signin' ? 'Signed in successfully.' : 'Sign-up successful—check your email.');
    setStatusType('success');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-slate-950 px-6 py-12 text-white">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-orange-400">MediaQuotes AI</p>
        <h1 className="text-4xl font-semibold">Creator access portal</h1>
        <p className="text-sm text-slate-300">
          Use the email linked to your team to sign in or create a new account. Every request is secured through Supabase
          Auth before you reach the dashboard.
        </p>
      </div>

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)]">
        <div className="flex gap-2 text-xs uppercase tracking-[0.4em] text-slate-400">
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signin' ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'}`}
            onClick={() => setMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-full py-2 transition ${mode === 'signup' ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'}`}
            onClick={() => setMode('signup')}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="flex flex-col gap-1 text-slate-200">
              Name
              <input
                className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-base text-white outline-none focus:border-orange-400"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Creator name"
                required={mode === 'signup'}
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-slate-200">
            Email
            <input
              className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-base text-white outline-none focus:border-orange-400"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@mediaquotes.ai"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-slate-200">
            Password
            <input
              className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-base text-white outline-none focus:border-orange-400"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              required
            />
          </label>
          <button className="w-full rounded-2xl bg-orange-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300" type="submit">
            {mode === 'signin' ? 'Continue to dashboard' : 'Create account'}
          </button>
        </form>

        {statusMessage && (
          <p className={`text-center text-xs ${statusType === 'success' ? 'text-green-400' : 'text-rose-400'}`}>
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}
