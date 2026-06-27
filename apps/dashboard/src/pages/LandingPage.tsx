import { Shield, MessageSquare, Zap, Bot, BarChart2 } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-sans selection:bg-[#1f6feb] selection:text-white antialiased">
      {/* Navbar */}
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
        
        {/* Nav Links Center */}
        <div className="hidden md:flex items-center gap-6 text-sm text-[#8b949e]">
          <a href="#workflow" className="hover:text-white transition-colors">How it works</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#onboarding" className="hover:text-white transition-colors">Onboarding</a>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
        </div>

        <div>
          <a
            href="https://devflow-api-gateway.onrender.com/auth/github"
            className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors"
            style={{ color: '#ffffff' }}
          >
            Sign in with GitHub
          </a>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="px-6 pt-20 pb-16 text-center max-w-5xl mx-auto flex flex-col items-center">
          {/* Pill Badge */}
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#30363d] bg-[#161b22] text-xs text-[#8b949e]">
            <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse"></span>
            <span>Now reviewing in under 60s</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-white leading-tight">
            AI code reviews.<br />
            <span className="text-[#58a6ff]">Inline. Instant.</span>
          </h1>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-[#8b949e] mb-10 max-w-3xl leading-relaxed">
            DevFlow CI catches SQL injection, hardcoded secrets, and unhandled errors — posting structured OWASP comments directly on your GitHub PR in under 60 seconds.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-16">
            <a
              href="https://github.com/apps/devflow-ci"
              className="w-full sm:w-auto border border-[#30363d] px-8 py-3.5 rounded-md text-base font-semibold transition-colors text-center flex items-center justify-center gap-1.5"
              style={{ backgroundColor: '#21262d', color: '#ffffff' }}
            >
              Install on GitHub →
            </a>
            <a
              href="#workflow"
              className="w-full sm:w-auto bg-transparent hover:bg-[#161b22]/50 border border-[#30363d] text-[#e6edf3] px-8 py-3.5 rounded-md text-base font-semibold transition-colors text-center"
            >
              View Demo
            </a>
          </div>

          {/* Realistic GitHub PR Inline Comment Mock */}
          <div className="w-full max-w-3xl border border-[#30363d] rounded-lg overflow-hidden bg-[#0d1117] text-left shadow-2xl">
            {/* File header bar */}
            <div className="bg-[#161b22] px-4 py-2.5 border-b border-[#30363d] flex items-center justify-between text-xs text-[#8b949e] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[#e6edf3] font-semibold">userService.ts</span>
                <span>·</span>
                <span className="text-[#3fb950] font-semibold">+3</span>
                <span className="text-[#f85149] font-semibold">-1</span>
              </div>
              <div>PR #14</div>
            </div>

            {/* Code diff lines */}
            <div className="font-mono text-xs select-none">
              <div className="flex bg-[#f85149]/10 text-[#f85149] border-l-2 border-[#f85149]">
                <div className="w-12 text-center text-[#8b949e] py-1 border-r border-[#30363d]/50 bg-[#f85149]/5">3</div>
                <div className="px-4 py-1 flex-1 whitespace-pre-wrap overflow-x-auto text-[#f85149]">
                  {"-   const query = `SELECT * FROM users WHERE id = '${id}'`;"}
                </div>
              </div>
            </div>

            {/* Bot Comment Container */}
            <div className="p-4 bg-[#161b22] border-t border-[#30363d] flex gap-3">
              {/* Bot avatar placeholder */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7] flex items-center justify-center text-white font-extrabold text-[10px] shrink-0 select-none">
                DF
              </div>
              
              <div className="flex-1 min-w-0">
                {/* Bot header info */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-white">devflow-ci</span>
                  <span className="text-[10px] font-medium text-[#8b949e] border border-[#30363d] px-1.5 py-0.2 rounded bg-[#21262d]">BOT</span>
                  <span className="text-xs text-[#8b949e]">commented 52s ago</span>
                </div>

                {/* Review Card Inside Comment */}
                <div className="border border-[#30363d] rounded-md bg-[#0d1117] overflow-hidden">
                  {/* Title & Badge */}
                  <div className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#e6edf3] flex items-center gap-1.5">
                      <span>⚠️</span> DevFlow CI: SQL Injection Risk
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-white bg-[#cf222e] px-2 py-0.5 rounded-full">Critical</span>
                      <span className="text-[10px] font-bold text-[#8b949e] border border-[#30363d] px-2 py-0.5 rounded-full">Security</span>
                      <span className="text-[10px] font-mono text-[#8b949e] border border-[#30363d] px-2 py-0.5 rounded-full">userService.ts:4</span>
                    </div>
                  </div>

                  {/* Content body */}
                  <div className="p-4 space-y-4 text-xs text-[#e6edf3]">
                    <div>
                      <div className="text-[10px] font-extrabold tracking-wider text-[#8b949e] uppercase mb-1.5">Why this is dangerous</div>
                      <p className="text-[#8b949e] leading-relaxed">
                        Constructing database queries by interpolating untrusted input directly allows users to manipulate the database query execution path. Attackers can leverage this SQL Injection vulnerability to bypass authentication, expose sensitive customer data, or potentially drop tables.
                      </p>
                    </div>

                    <div>
                      <a
                        href="https://owasp.org/www-project-top-ten/2021/A03_2021-Injection"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#58a6ff] hover:underline font-semibold flex items-center gap-1"
                      >
                        🔗 OWASP Reference: OWASP A03:2021 — Injection
                      </a>
                    </div>

                    <div>
                      <div className="text-[10px] font-extrabold tracking-wider text-[#8b949e] uppercase mb-1.5">Suggested Fix</div>
                      <div className="rounded-md border border-[#30363d] bg-[#161b22] p-3 font-mono text-xs text-[#e6edf3] overflow-x-auto">
                        <span className="text-[#8b949e]">// Secure parameterized query fix</span><br />
                        <span className="text-[#ff7b72]">const</span> query <span className="text-[#ff7b72]">=</span> <span className="text-[#a5d6ff]">'SELECT * FROM users WHERE id = $1'</span>;<br />
                        <span className="text-[#ff7b72]">const</span> result <span className="text-[#ff7b72]">=</span> <span className="text-[#ff7b72]">await</span> db.query(query, [id]);
                      </div>
                    </div>
                  </div>

                  {/* Footer info inside Card */}
                  <div className="bg-[#161b22] px-4 py-2 border-t border-[#30363d] text-[10px] text-[#8b949e] italic">
                    AI-generated fix — review before applying
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="workflow" className="px-6 py-24 bg-[#161b22]/30 border-t border-[#30363d]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold tracking-widest text-[#58a6ff] uppercase">Workflow</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2">How it works</h2>
            </div>
            
            <div className="relative flex flex-col md:flex-row justify-between items-center gap-12 md:gap-4">
              {/* Connecting line */}
              <div className="absolute top-6 left-0 right-0 h-[2px] bg-[#30363d] hidden md:block z-0" />
              
              {[
                {
                  step: 1,
                  title: "Install GitHub App",
                  desc: "Grant access to your repositories in one click."
                },
                {
                  step: 2,
                  title: "Connect repository",
                  desc: "Register your repository inside the dashboard."
                },
                {
                  step: 3,
                  title: "Open a PR, review in <60s",
                  desc: "Keep writing code as normal, and get reviews automatically."
                }
              ].map((item, idx) => (
                <div key={idx} className="relative z-10 flex flex-col items-center text-center max-w-xs bg-[#0d1117] md:bg-transparent px-6">
                  <div className="w-12 h-12 rounded-full bg-[#161b22] border-2 border-[#30363d] text-white flex items-center justify-center font-bold text-lg mb-4 shadow-lg transition-colors">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{item.title}</h3>
                  <p className="text-sm text-[#8b949e] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-6 py-24 max-w-5xl mx-auto border-t border-[#30363d]">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-[#58a6ff] uppercase">Features</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2">Built for developers who ship fast</h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "AI-Powered Reviews",
                description: "Gemini 2.5 Flash analyzes your code instantly for bugs, safety threats, and optimization opportunities."
              },
              {
                icon: MessageSquare,
                title: "Inline PR Comments",
                description: "Precise comments on the exact line of code, not a block of text on the PR main summary."
              },
              {
                icon: Bot,
                title: "Posts as GitHub App Bot",
                description: "Standard GitHub App integration that posts comments directly on PR diffs under its own name."
              },
              {
                icon: Shield, // Replaced placeholder with standard Lucide Shield
                title: "OWASP Top 10 References",
                description: "Deep context mappings and links to official vulnerability guides for secure code education."
              },
              {
                icon: Zap,
                title: "Under 60 Seconds",
                description: "Designed for speed, analyzing code changes and posting results in under a minute."
              },
              {
                icon: BarChart2,
                title: "Review Dashboard",
                description: "Complete web dashboard tracking connected repositories, scan execution history, and metrics."
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl hover:border-[#58a6ff] transition-all group duration-200">
                <feature.icon className="w-8 h-8 text-[#58a6ff] mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-sm text-[#8b949e] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Onboarding Section */}
        <section id="onboarding" className="px-6 py-24 bg-[#161b22]/50 border-t border-[#30363d]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold text-center mb-16 text-white">Get started in 4 steps</h2>
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

        {/* Privacy & Security Section */}
        <section className="px-6 py-24 border-t border-[#30363d]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold text-center mb-16 text-white">Built with privacy and security in mind</h2>
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

        {/* Troubleshooting Table Section */}
        <section className="px-6 py-24 max-w-5xl mx-auto border-t border-[#30363d]">
          <h2 className="text-3xl font-extrabold text-center mb-16 text-white">Troubleshooting</h2>
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

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[#30363d] flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[#8b949e] max-w-7xl mx-auto">
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
