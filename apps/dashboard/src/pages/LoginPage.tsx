import { API_BASE_URL } from "../config";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gh-sidebar px-4 py-12">
      <div className="w-full max-w-[340px] text-center">
        <svg className="mx-auto h-16 w-16 text-gh-text-primary mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M6 5 L4 1 L8 3" />
          <path d="M16 5 L18 1 L14 3" />
          <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="18" r="4" />
          <path d="M20.8 20.8 L23 23" />
        </svg>

        <h1 className="text-2xl font-light text-gh-text-primary tracking-tight mb-4">
          Sign in to DevFlow CI
        </h1>

        <div className="rounded-md border border-gh-border bg-gh-card p-4 shadow-sm text-center">
          <a
            href={`${API_BASE_URL}/auth/github`}
            className="inline-block w-full rounded-md bg-[#1F883D] px-4 py-[5px] text-sm border border-[rgba(31,35,40,0.15)] transition-colors hover:bg-[#1a7431]"
            style={{ color: '#ffffff', fontWeight: 600 }}
          >
            Sign in with GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
