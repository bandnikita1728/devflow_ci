
export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gh-text-primary mb-6">Privacy Policy</h1>
      
      <div className="space-y-6 text-gh-text-secondary">
        <section className="bg-gh-card border border-gh-border rounded-md p-6">
          <h2 className="text-lg font-medium text-gh-text-primary mb-3">1. What Data We Collect</h2>
          <p className="mb-2">We collect the following information when you use DevFlow CI:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your GitHub profile information (username, ID, avatar, email)</li>
            <li>OAuth access tokens to perform API actions on your behalf</li>
            <li>Pull Request diffs and repository metadata for repositories you authorize</li>
          </ul>
        </section>

        <section className="bg-gh-card border border-gh-border rounded-md p-6">
          <h2 className="text-lg font-medium text-gh-text-primary mb-3">2. How We Use Your Data</h2>
          <p>
            Your data is strictly used to provide the DevFlow CI code review service. We do not sell your data or use it for advertising purposes.
          </p>
        </section>

        <section className="bg-gh-card border border-gh-border rounded-md p-6">
          <h2 className="text-lg font-medium text-gh-text-primary mb-3">3. Third-Party Subprocessors</h2>
          <p>
            DevFlow CI utilizes Google's Gemini AI to perform code analysis. When a Pull Request is analyzed, the code diffs are sent securely to the Gemini API. We have explicitly configured the Gemini API to <strong>opt out of data training</strong>, ensuring your proprietary code is treated as strictly confidential and is never used to train Google's AI models.
          </p>
        </section>

        <section className="bg-gh-card border border-gh-border rounded-md p-6">
          <h2 className="text-lg font-medium text-gh-text-primary mb-3">4. Data Retention</h2>
          <p>
            We retain your code reviews and profile data for as long as your account is active. You have the right to request deletion of your data at any time.
          </p>
        </section>

        <section className="bg-gh-card border border-gh-border rounded-md p-6">
          <h2 className="text-lg font-medium text-gh-text-primary mb-3">5. Your Rights & Account Deletion</h2>
          <p>
            You have full control over your data. You can permanently delete your account and all associated data (including reviews, repository links, and tokens) from the Settings page. This action is irreversible.
          </p>
        </section>

        <section className="bg-gh-card border border-gh-border rounded-md p-6">
          <h2 className="text-lg font-medium text-gh-text-primary mb-3">6. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or your data, please contact the DevFlow CI maintainers.
          </p>
        </section>
      </div>
    </div>
  );
}
