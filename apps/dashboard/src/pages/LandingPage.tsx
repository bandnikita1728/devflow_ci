import { Shield, MessageSquare, Zap, Bot, CheckCircle, BarChart2 } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-sans selection:bg-[#1f6feb] selection:text-white">
      {/* 1 - Top Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#161b22]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M6 5 L4 1 L8 3" />
            <path d="M16 5 L18 1 L14 3" />
            <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="18" cy="18" r="4" />
            <path d="M20.8 20.8 L23 23" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">DevFlow CI</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://devflow-api-gateway.onrender.com/auth/github"
            className="text-sm font-medium text-[#e6edf3] hover:text-[#58a6ff] transition-colors"
          >
            Sign in
          </a>
          <a
            href="https://devflow-api-gateway.onrender.com/auth/github"
            className="bg-[#238636] hover:bg-[#2ea043] text-[#ffffff] px-4 py-2 rounded-md text-sm font-semibold transition-colors"
            style={{ color: '#ffffff' }}
          >
            Sign in with GitHub
          </a>
        </div>
      </nav>

      <main>
        {/* 2 - Hero Section */}
        <section className="px-6 py-24 md:py-32 text-center max-w-4xl mx-auto flex flex-col items-center">
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#30363d] bg-[#161b22] text-sm text-[#8b949e]">
            <span>✨ Now powered by Gemini 2.5 Flash</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-8 text-white">
            AI code reviews. Inline. Instant.
          </h1>
          <p className="text-xl md:text-2xl text-[#8b949e] mb-10 max-w-3xl leading-relaxed">
            DevFlow CI reviews every Pull Request instantly — catching security vulnerabilities, bugs, and bad practices before they hit main.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-6">
            <a
              href="https://github.com/apps/devflow-ci"
              className="w-full sm:w-auto bg-[#0969da] hover:bg-[#1f6feb] text-[#ffffff] px-8 py-3.5 rounded-md text-base font-semibold transition-colors text-center flex items-center justify-center gap-2"
              style={{ color: '#ffffff' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Install on GitHub
            </a>
            <a
              href="#features"
              className="w-full sm:w-auto bg-[#161b22] hover:bg-[#30363d] border border-[#30363d] text-[#e6edf3] px-8 py-3.5 rounded-md text-base font-semibold transition-colors text-center"
            >
              View Demo
            </a>
          </div>
          <p className="text-sm text-[#8b949e]">
            Free to use · No credit card required · Powered by Gemini AI
          </p>
        </section>

        {/* 3 - How it works */}
        <section className="px-6 py-20 bg-[#161b22] border-y border-[#30363d]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: 1,
                  title: "Connect your GitHub repo",
                  description: "Authorize DevFlow CI to access your repositories with one click."
                },
                {
                  step: 2,
                  title: "Open a Pull Request",
                  description: "Keep working as usual. Open a PR and DevFlow CI is instantly triggered."
                },
                {
                  step: 3,
                  title: "Get inline AI code review",
                  description: "Receive actionable feedback right on the lines of code that need it."
                }
              ].map((item) => (
                <div key={item.step} className="bg-[#0d1117] border border-[#30363d] p-6 rounded-xl relative">
                  <div className="w-10 h-10 bg-[#238636] text-white rounded-full flex items-center justify-center font-bold text-lg mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{item.title}</h3>
                  <p className="text-[#8b949e]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4 - Features section */}
        <section id="features" className="px-6 py-24 max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need for better code</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Security scanning",
                description: "Catches SQL injection, hardcoded secrets, XSS, and more."
              },
              {
                icon: MessageSquare,
                title: "Inline comments",
                description: "Actionable feedback on the exact line, not a wall of text."
              },
              {
                icon: Zap,
                title: "Instant reviews",
                description: "Under 60 seconds from PR open to review posted."
              },
              {
                icon: Bot,
                title: "Powered by Gemini AI",
                description: "Google's latest model for highly accurate code analysis."
              },
              {
                icon: CheckCircle,
                title: "HMAC verified",
                description: "Only real GitHub events get processed securely."
              },
              {
                icon: BarChart2,
                title: "Review dashboard",
                description: "Track all your reviews, stats, and history in one place."
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl hover:border-[#58a6ff] transition-colors group">
                <feature.icon className="w-8 h-8 text-[#58a6ff] mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-[#8b949e]">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ONBOARDING SECTION */}
        <section className="px-6 py-20 bg-[#161b22]/50 border-t border-[#30363d]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">Get started in 4 steps</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  step: 1,
                  title: "Step 1 — Install the GitHub App",
                  body: (
                    <>
                      Go to <a href="https://github.com/apps/devflow-ci" target="_blank" rel="noreferrer" className="text-[#58a6ff] hover:underline">github.com/apps/devflow-ci</a> and click Install.<br />
                      Select your GitHub account and choose which repositories to allow.<br />
                      You'll get a confirmation email from GitHub — no action needed.
                    </>
                  )
                },
                {
                  step: 2,
                  title: "Step 2 — Sign in to the Dashboard",
                  body: "Click \"Sign in with GitHub\" and authorize DevFlow CI. Accept the privacy notice on first login."
                },
                {
                  step: 3,
                  title: "Step 3 — Connect a Repository",
                  body: "Go to Repositories → Connect Repository. Enter your repo as owner/repo (e.g. nikitaband/myapp). The GitHub App must be installed on the repo owner's account first."
                },
                {
                  step: 4,
                  title: "Step 4 — Open a Pull Request",
                  body: "Create a branch, make changes, open a PR. The DevFlow CI bot posts inline comments within 60 seconds."
                }
              ].map((item) => (
                <div key={item.step} className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#1f6feb] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-white">{item.title}</h3>
                    <p className="text-[#8b949e] leading-relaxed text-sm">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRIVACY & SECURITY SECTION */}
        <section className="px-6 py-20 border-t border-[#30363d]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">Built with privacy and security in mind</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: "🔐 AES-256 Encryption",
                  body: "Your GitHub tokens are encrypted at rest using AES-256. Never stored in plain text."
                },
                {
                  title: "🔏 Zero AI Training",
                  body: "We instruct Gemini to never train on your code. Your proprietary code stays strictly confidential."
                },
                {
                  title: "✅ HMAC Verification",
                  body: "Every webhook is cryptographically signed and verified to confirm it legitimately came from GitHub."
                },
                {
                  title: "🗑️ Full Data Deletion",
                  body: "Delete your account and all data — repos, reviews, tokens — is permanently purged instantly."
                }
              ].map((item, idx) => (
                <div key={idx} className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-2 text-white">{item.title}</h3>
                  <p className="text-[#8b949e] leading-relaxed text-sm">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 - CTA section */}
        <section className="px-6 py-24 bg-[#161b22] border-t border-[#30363d] text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 text-white">Start reviewing code smarter.</h2>
            <p className="text-xl text-[#8b949e] mb-8">Connect your first repo in under 2 minutes.</p>
            <a
              href="https://devflow-api-gateway.onrender.com/auth/github"
              className="inline-flex bg-[#238636] hover:bg-[#2ea043] text-[#ffffff] px-8 py-4 rounded-md text-lg font-bold transition-colors shadow-lg hover:shadow-[#238636]/20"
              style={{ color: '#ffffff' }}
            >
              Sign in with GitHub
            </a>
          </div>
        </section>

        {/* Troubleshooting table section */}
        <section className="px-6 py-20 max-w-5xl mx-auto border-t border-[#30363d]">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">Troubleshooting</h2>
          <div className="overflow-x-auto border border-[#30363d] rounded-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#30363d] bg-[#161b22]">
                  <th className="p-4 font-semibold text-white w-1/3">Issue</th>
                  <th className="p-4 font-semibold text-white">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] bg-[#0d1117]">
                <tr>
                  <td className="p-4 text-[#e6edf3] font-medium">Bot not commenting</td>
                  <td className="p-4 text-[#8b949e]">Install GitHub App on the repo owner's account first</td>
                </tr>
                <tr>
                  <td className="p-4 text-[#e6edf3] font-medium">Webhook registration failed</td>
                  <td className="p-4 text-[#8b949e]">Install the App first, then reconnect the repo</td>
                </tr>
                <tr>
                  <td className="p-4 text-[#e6edf3] font-medium">AI review temporarily unavailable</td>
                  <td className="p-4 text-[#8b949e]">Gemini is busy — open a new PR in 2-3 minutes</td>
                </tr>
                <tr>
                  <td className="p-4 text-[#e6edf3] font-medium">Reviews not in dashboard</td>
                  <td className="p-4 text-[#8b949e]">Sign out and sign back in with your GitHub account</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* 6 - Footer */}
      <footer className="px-6 py-8 border-t border-[#30363d] flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[#8b949e]">
        <div>
          DevFlow CI © 2026 · Built by Nikita Band
        </div>
        <div className="flex gap-6">
          <a href="/privacy" className="hover:text-[#58a6ff] transition-colors" style={{ color: '#8b949e' }}>Privacy Policy</a>
          <a href="https://github.com/bandnikita1728/devflow_ci" target="_blank" rel="noreferrer" className="hover:text-[#58a6ff] transition-colors">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
