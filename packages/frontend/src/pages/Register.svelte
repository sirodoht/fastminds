<script>
  import { Link } from "../router/index.js";

  let username = $state("");
  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = "";
    loading = true;

    try {
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

  <p class="payment-intro">To verify you're a real person, we charge a one-time <strong>$1.00</strong> fee when you sign up. You'll be redirected to Stripe to complete the payment.</p>

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

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? "Redirecting to Stripe…" : "Continue to Stripe payment"}
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
</style>
