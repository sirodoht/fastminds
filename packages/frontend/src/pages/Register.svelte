<script>
  import { Link, navigate } from "../router/index.js";
  import { token, user } from "../lib/stores.js";

  let username = $state("");
  let email = $state("");
  let password = $state("");
  let agreeTerms = $state(false);
  let error = $state("");
  let loading = $state(false);

  const bypass = new URLSearchParams(window.location.search).get("bypass") === "true";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!agreeTerms) {
      error = "You must agree to the Terms of Service to continue.";
      return;
    }

    error = "";
    loading = true;

    try {
      if (bypass) {
        const res = await fetch("/api/auth/register/bypass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const data = await res.json();
        token.set(data.token);
        user.set(data.user);
        navigate("/");
        return;
      }

      const res = await fetch("/api/auth/register/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      error = err.message;
      loading = false;
    }
  }
</script>

<div class="form-card">
  <h1>Create an account</h1>

  {#if bypass}
    <p class="payment-intro"><strong>Bypass mode:</strong> No payment required. Registration will complete immediately.</p>
  {:else}
    <p class="payment-intro">To filter out fake accounts, we charge a one-time <strong>$1.00</strong> fee when you sign up. You'll be redirected to Stripe to complete the payment.</p>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="form-group">
      <label for="username">Username</label>
      <input id="username" type="text" bind:value={username} placeholder="choose a username" required minlength={3} />
    </div>

    <div class="form-group">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} placeholder="you@example.com" required />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} placeholder="choose a password" required />
    </div>

    <div class="checkbox-group">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={agreeTerms} />
        <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
      </label>
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? (bypass ? "Creating account…" : "Redirecting to Stripe…") : (bypass ? "Create account" : "Continue to Stripe payment")}
    </button>
  </form>

  <div class="form-footer">
    Already have an account? <Link href="/login">Log in</Link>
  </div>
</div>

<style>
  .payment-intro {
    margin-bottom: 1rem;
    font-size: 0.95rem;
    color: #444;
  }
  .checkbox-group {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: #333;
    cursor: pointer;
  }
  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 0.15rem;
    width: auto;
  }
</style>
