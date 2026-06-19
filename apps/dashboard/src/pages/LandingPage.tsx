import { Shield, MessageSquare, Zap, Bot, CheckCircle, BarChart2 } from 'lucide-react';

export function LandingPage() {
  const authUrl = "https://devflow-api-gateway.onrender.com/auth/github";

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
            href={authUrl}
            className="text-sm font-medium text-[#e6edf3] hover:text-[#58a6ff] transition-colors"
          >
            Sign in
          </a>
          <a
            href={authUrl}
            className="bg-[#238636] hover:bg-[#2ea043] text-[#ffffff] px-4 py-2 rounded-md text-sm font-semibold transition-colors"
          >
            Get started free
          </a>
        </div>
      </nav>

      <main>
        {/* 2 - Hero Section */}
        <section className="px-6 py-24 md:py-32 text-center max-w-4xl mx-auto flex flex-col items-center">
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#30363d] bg-[#161b22] text-sm text-[#8b949e]">
            <span>✨ Now powered by Gemini 2.5 Flash</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 text-white">
            AI Code Reviews, Automatically.
          </h1>
          <p className="text-sm text-[#8b949e] mb-8">
            by Nikita Band
          </p>
          <p className="text-xl md:text-2xl text-[#8b949e] mb-10 max-w-3xl leading-relaxed">
            DevFlow CI reviews every Pull Request instantly — catching security vulnerabilities, bugs, and bad practices before they hit main.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-6">
            <a
              href={authUrl}
              className="w-full sm:w-auto bg-[#238636] hover:bg-[#2ea043] text-[#ffffff] px-8 py-3.5 rounded-md text-base font-semibold transition-colors text-center"
            >
              Get started free
            </a>
            <a
              href="#features"
              className="w-full sm:w-auto bg-[#161b22] hover:bg-[#30363d] border border-[#30363d] text-[#e6edf3] px-8 py-3.5 rounded-md text-base font-semibold transition-colors text-center"
            >
              View demo
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

        {/* 5 - CTA section */}
        <section className="px-6 py-24 bg-[#161b22] border-t border-[#30363d] text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 text-white">Start reviewing code smarter.</h2>
            <p className="text-xl text-[#8b949e] mb-8">Connect your first repo in under 2 minutes.</p>
            <a
              href={authUrl}
              className="inline-flex bg-[#238636] hover:bg-[#2ea043] text-[#ffffff] px-8 py-4 rounded-md text-lg font-bold transition-colors shadow-lg hover:shadow-[#238636]/20"
            >
              Sign in with GitHub
            </a>
          </div>
        </section>
      </main>

      {/* 6 - Footer */}
      <footer className="px-6 py-8 border-t border-[#30363d] flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[#8b949e]">
        <div>
          DevFlow CI © 2026 · Built by Nikita Band
        </div>
        <div className="flex gap-6">
          <a href="/privacy" className="hover:text-[#58a6ff] transition-colors">Privacy Policy</a>
          <a href="https://github.com/bandnikita1728/devflow_ci" target="_blank" rel="noreferrer" className="hover:text-[#58a6ff] transition-colors">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
