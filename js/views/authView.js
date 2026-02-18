import { getUiState, updateUiState } from '../uiStore.js';
import { signInUser, signUpUser } from '../auth.js';

function field(label, type, name, required = false) {
  return `
    <label class="field">
      ${label}
      <input type="${type}" name="${name}" ${required ? 'required' : ''} />
    </label>
  `;
}

export function renderAuthView(container) {
  const uiState = getUiState();
  const isSignup = uiState.authViewMode === 'signup';

  container.innerHTML = `
    <div class="auth-card">
      <h1>Welcome to BoothRent Pro</h1>
      <div class="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
        <button class="btn ${!isSignup ? 'btn-primary' : 'btn-ghost'}" data-mode="signin" type="button">Sign In</button>
        <button class="btn ${isSignup ? 'btn-primary' : 'btn-ghost'}" data-mode="signup" type="button">Create Account</button>
      </div>

      <form id="authForm" class="auth-form">
        ${field('Email', 'email', 'email', true)}
        ${field('Password', 'password', 'password', true)}

        ${
          isSignup
            ? `
          ${field('Business Name', 'text', 'businessName', true)}
          ${field('Phone', 'text', 'phone')}
          ${field('Address 1', 'text', 'address1')}
          ${field('City', 'text', 'city')}
          ${field('State', 'text', 'state')}
          ${field('Zip', 'text', 'zip')}
        `
            : ''
        }

        <button class="btn btn-primary" type="submit" ${uiState.authLoading ? 'disabled' : ''}>
          ${uiState.authLoading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
        </button>

        <button class="auth-switch-link" type="button" id="switchModeButton">
          ${isSignup ? 'Already have an account? Sign In' : 'Need an account? Create Account'}
        </button>

        ${uiState.authError ? `<p class="auth-error">${uiState.authError}</p>` : ''}
      </form>
    </div>
  `;

  container.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      updateUiState({ authViewMode: button.dataset.mode, authError: '' });
      renderAuthView(container);
    });
  });

  container.querySelector('#switchModeButton').addEventListener('click', () => {
    const nextMode = isSignup ? 'signin' : 'signup';
    updateUiState({ authViewMode: nextMode, authError: '' });
    renderAuthView(container);
  });

  container.querySelector('#authForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '').trim();

    updateUiState({ authLoading: true, authError: '' });
    renderAuthView(container);

    if (isSignup) {
      const businessName = String(formData.get('businessName') || '').trim();
      if (!businessName) {
        updateUiState({ authLoading: false, authError: 'Business Name is required.' });
        renderAuthView(container);
        return;
      }

      const result = await signUpUser({
        email,
        password,
        businessProfile: {
          businessName,
          phone: String(formData.get('phone') || '').trim(),
          address1: String(formData.get('address1') || '').trim(),
          city: String(formData.get('city') || '').trim(),
          state: String(formData.get('state') || '').trim(),
          zip: String(formData.get('zip') || '').trim(),
        },
      });

      updateUiState({ authLoading: false, authError: result.error || '' });
      if (!result.ok) renderAuthView(container);
      return;
    }

    const result = await signInUser({ email, password });
    updateUiState({ authLoading: false, authError: result.error || '' });
    if (!result.ok) renderAuthView(container);
  });
}
