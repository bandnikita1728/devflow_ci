import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { PrivacyPage } from '../PrivacyPage';

describe('PrivacyPage Component', () => {
  test('renders Privacy Policy heading and sections', () => {
    render(<PrivacyPage />);

    // Check heading
    const heading = screen.getByRole('heading', { name: /privacy policy/i });
    expect(heading).toBeInTheDocument();

    // Check key content texts
    expect(screen.getByText(/What Data We Collect/i)).toBeInTheDocument();
    expect(screen.getByText(/Third-Party Subprocessors/i)).toBeInTheDocument();
    expect(screen.getByText(/opt out of data training/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Rights & Account Deletion/i)).toBeInTheDocument();
  });
});
